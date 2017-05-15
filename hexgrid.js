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
  yield center;
  if (maxRings === 0) {
    return;
  }
  for (var ringNum = 1; ringNum <= maxRings; ringNum++) {
    for (var offset=0; offset < hexGridMaxOffset(ringNum); offset++) {
      yield hexGridIdToCoord(center, steps, ringNum, offset);
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
  // var regionLabel = new MapLabel({
  //   text: title,
  //   position: new google.maps.LatLng(midLat, midLng),
  //   map: map,
  //   fontSize: 16,
  //   strokeWeight: 8,
  //   minZoom: 10
  // });
  var regionLabel = new MapLabel(regionLabelConfig);
}

function renderHexGrid(center, map, steps, ringCount) {
  for(const hexCenter of hexGridCenters(center, steps, ringCount)) {
    const path = getHex(hexCenter, steps);
    map.data.add({
      geometry: new google.maps.Data.Polygon([path]),
      properties: {
        style: {
          fillColor: '#222222',
          strokeWeight: 1,
          strokeColor: '#666666',
          strokeOpacity: 0.2
        }
      }
    });
  }
}

// function regionPath(center, steps, hexCoords) {
//   var path = [];
//   for (const hexCoord of hexCoords) {
//     if (path.length === 0) {
//       path.push(Object.assign(hexCoord, {sides:[0,1,2,3,4,5]}));
//       continue;
//     }
//     var currRing = hexCoord.ring;
//     for (const existingCoord of path) {
//       existingRing = existingCoord.ring;
//       // We need these for 2+ branches of the if-else block below.
//       var insideCoord = {};
//       var outsideCoord = {};
//       filledHexCoord = Object.assign(hexCoord, {sides:[0,1,2,3,4,5]});
//       if(currRing === existingRing) {
//         var firstHex = {};
//         var secondHex = {};
//         if (existingCoord.offset === hexCoord.offset) {
//           // Duplicate entry.
//           break;
//         }
//         else if (existingCoord.offset < hexCoord.offset) {
//           firstHex = existingCoord;
//           secondHex = filledHexCoord;
//         } else {
//           firstHex = filledHexCoord;
//           secondHex = existingCoord;
//         }
//         var firstHexSide = getHexSideNum(firstHex.ring, firstHex.offset);
//         var joinSide = firstHexSide + 2;  // I leave the proof of this as an exercise to the reader.
//         doHexJoin(firstHex, secondHex, joinSide);
//         path.push(secondHex);
//       }
//       // These blocks are kind of not DRY, but there's a matrix effect going on.
//       else if(currRing - existingRing === 1) {
//         var outsideCoord = filledHexCoord;
//         var insideCoord = existingCoord;
//         var translatedOffset = outsideCoord.offset * insideCoord.ring/outsideCoord.ring;
//         if (insideCoord.offset === Math.floor(translatedOffset)) {
//           // We have a match!
//           var sideNum = getHexSideNum(insideCoord.ring, insideCoord.offset);
//           var mergedSide = (sideNum + 4) % 6;
//           mergeHexes(insideCoord, outsideCoord, mergedSide);
//         }
//         if (insideCoord.offset === Math.ceil(translatedOffset)) {
//           // We have a match!
//           var sideNum = getHexSideNum(outsideCoord.ring, outsideCoord.offset);
//           var mergedSide = (sideNum + 3) % 6;
//           mergeHexes(outsideCoord, insideCoord, mergedSide);
//         }
//       }
//       else if(currRing - existingRing === -1) {
//         var insideCoord = filledHexCoord;
//         var outsideCoord = existingCoord;
//         var translatedOffset = outsideCoord.offset * insideCoord.ring/outsideCoord.ring;
//         if (insideCoord.offset === Math.floor(translatedOffset)) {
//           // We have a match!
//           var sideNum = getHexSideNum(insideCoord.ring, insideCoord.offset);
//           var mergedSide = (sideNum + 4) % 6;
//           mergeHexes(insideCoord, outsideCoord, mergedSide);
//         }
//         if (insideCoord.offset === Math.ceil(translatedOffset)) {
//           // We have a match!
//           var sideNum = getHexSideNum(outsideCoord.ring, outsideCoord.offset);
//           var mergedSide = (sideNum + 3) % 6;
//           mergeHexes(outsideCoord, insideCoord, mergedSide);
//         }
//       }
//     }
//   }
//
//   return path;
// }
//
// function mergeHexes(hex1, hex2, joiningSideNum) {
//   hex1.sides.splice(hex1.sides.indexOf(joiningSideNum), 1)
//   const altJoiningSideNum = (joiningSideNum + 3) % 6
//   hex2.sides.splice(hex2.sides.indexOf(altJoiningSideNum), 1)
// }
