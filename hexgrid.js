var scanRadius=70;

function getRadius(steps) {
  return ((steps - 1) * Math.sqrt(3) * scanRadius) + scanRadius;
}

function getNextCenter(currentCenter, steps, heading, numHexes) {
  // Only works for headings 0, 60, 120, ...
  var radius = getRadius(steps);
  var corner1 = google.maps.geometry.spherical.computeOffset(currentCenter, radius, heading + 30);
  var corner2 = google.maps.geometry.spherical.computeOffset(currentCenter, radius, heading - 30);
  var midpoint = google.maps.geometry.spherical.interpolate(corner1, corner2, 0.5);
  return google.maps.geometry.spherical.interpolate(currentCenter, midpoint, 2.0*numHexes);
}

function getCenterToCenterDistance(steps, numHexes) {
  // only works on continuous face-to-face hex lines.
  const scalar = 1.154697265625; // This is a very close guess. Can't tell if low or high.
  const radius = getRadius(steps);
  return numHexes * 2 * radius / scalar;
}

function getHex(center, steps) {
  var radius = getRadius(steps);
  return [
    google.maps.geometry.spherical.computeOffset(center, radius, 30),
    google.maps.geometry.spherical.computeOffset(center, radius, 90),
    google.maps.geometry.spherical.computeOffset(center, radius, 150),
    google.maps.geometry.spherical.computeOffset(center, radius, 210),
    google.maps.geometry.spherical.computeOffset(center, radius, 270),
    google.maps.geometry.spherical.computeOffset(center, radius, 330)
  ];
}

function hexGridValidOffset(ringNum, offset) {
  if (ringNum == 0) {
    return offset === 0;
  }
  ringNum = ringNum + 1;
  var currRing = ringNum - 1
  var currentRingStartId = 3*currRing*currRing - 3*currRing + 2;
  var nextRingStartId = 3*ringNum*ringNum - 3*ringNum + 2;
  var maxOffset = nextRingStartId - currentRingStartId;
  return offset >= 0 && offset < maxOffset;
}

function hexGridMaxOffset(ringNum) {
  ringNum = ringNum+1;
  var currRing = ringNum - 1
  currentRingStartId = 3*currRing*currRing - 3*currRing + 2;
  nextRingStartId = 3*ringNum*ringNum - 3*ringNum + 2;
  maxOffset = nextRingStartId - currentRingStartId;
  return maxOffset;
}

function hexGridIdToCoord(center, steps, ringNum, offset) {
  if (!hexGridValidOffset(ringNum, offset)) {
    return null;
  }
  if (ringNum === 0) {
    return center;
  }
  // Two-step "explicit"; follow a spoke, then the ring's edge, using jumps.

  // Find the right spoke...
  const sideNum = getHexSideNum(ringNum, offset);
  const spokeAngle = sideNum*60;
  // Translate along the spoke...
  //var spokePoint = getNextCenter(center, steps, spokeAngle, ringNum);
  const spokeDistance = getCenterToCenterDistance(steps, ringNum);
  var spokePoint = google.maps.geometry.spherical.computeOffset(center, spokeDistance, spokeAngle);

  // Translate along the edge. The number of hexes to go is empirically derived.
  //return getNextCenter(spokePoint, steps, edgeAngle, offset%ringNum);
  const edgeAngleAdjustment = [0, .2, .2, 0, -.2, -.2]
  const edgeAngle = spokeAngle + 120 + edgeAngleAdjustment[sideNum];
  const edgeDistance = getCenterToCenterDistance(steps, offset%ringNum);
  return google.maps.geometry.spherical.computeOffset(spokePoint, edgeDistance, edgeAngle);
}

function getHexSideNum(ringNum, offset) {
  return Math.floor(offset/ringNum);
}

function* hexGridCenters(center, steps, maxRings) {
  yield {gps: center, gridLoc: {ringNum: 0, offset: 0}};
  if (maxRings === 0) {
    return;
  }
  for (var ringNum = 1; ringNum <= maxRings; ringNum++) {
    for (var offset=0; offset < hexGridMaxOffset(ringNum); offset++) {
      yield {
        gps: hexGridIdToCoord(center, steps, ringNum, offset),
        gridLoc: {
          ringNum: ringNum,
          offset: offset
        }
      };
    }
  }
}

function regionPath(center, steps, hexCoords) {
  return hexCoords.map(function(hex) {
    var hexLoc = hexGridIdToCoord(center, steps, hex.ring, hex.offset);
    return getHex(hexLoc, steps);
  });
}

function renderRegion(map, center, steps, hexes, title, style, textStyle) {
  var locs = hexes.map(function(hex) {return hexGridIdToCoord(center, steps, hex.ring, hex.offset);});
  var path = regionPath(center, steps, hexes);
  var polys = path.map(function (hexPath) {return new google.maps.Data.Polygon([hexPath]);});
  map.data.add({
    id: title,
    geometry: new google.maps.Data.MultiPolygon(polys),
    properties: {style: style}
  });

  var midLat = locs.map(function(loc) {return loc.lat();}).reduce(function(a,b) {return a+b;}, 0)/locs.length;
  var midLng = locs.map(function(loc) {return loc.lng();}).reduce(function(a,b) {return a+b;}, 0)/locs.length;
  var regionLabelConfig = Object.assign(textStyle, {
    text: title,
    position: new google.maps.LatLng(midLat, midLng),
    map: map
  });
  var regionLabel = new MapLabel(regionLabelConfig);
}

var infoBox = undefined;

function renderHexGrid(center, map, steps, ringCount) {
  if (infoBox === undefined) {
    infoBox = new google.maps.InfoWindow({});
  }
  for(const centerInfo of hexGridCenters(center, steps, ringCount)) {
    const hexCenter = centerInfo.gps;
    const path = getHex(hexCenter, steps);
    var poly = new google.maps.Data.Polygon([path]);
    map.data.add({
      geometry: poly,
      properties: {
        style: {
          fillColor: '#222222',
          strokeWeight: 1,
          strokeColor: '#666666',
          strokeOpacity: 0.2
        },
        gps: hexCenter,
        gridLoc: centerInfo.gridLoc
      }
    });
  }
  map.data.addListener('click', function (event) {
    console.log('Event handler fired.');
    infoBox.close()
    const feature = event.feature;
    const hexCenter = feature.getProperty('gps');
    const gridLoc = feature.getProperty('gridLoc');
    if (hexCenter === undefined || gridLoc === undefined) {
      return;
    }
    const content = "<div><p><b>GPS:</b> " + hexCenter.lat() + ", " + hexCenter.lng() + "</p>" +
                    "<p><b>Config Coords:</b> " + JSON.stringify(gridLoc) + "</p></div>";
    infoBox.setContent(content);
    infoBox.setPosition(hexCenter);
    infoBox.open(map);
  });
}
