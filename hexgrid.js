var scanRadius=70;

function distanceBetweenHexes(steps) {
  var radius = getRadius(steps);
  return radius * 2 - hexOverlap;
}

function getRadius(steps) {
  return ((steps - 1) * Math.sqrt(3) * scanRadius) + scanRadius;
}

function getNextCenter(currentCenter, heading, steps) {
  var radius = getRadius(steps);
  var corner1 = google.maps.geometry.spherical.computeOffset(currentCenter, radius, heading + 30);
  var corner2 = google.maps.geometry.spherical.computeOffset(currentCenter, radius, heading - 30);
  var midpoint = google.maps.geometry.spherical.interpolate(corner1, corner2, 0.5);
  return google.maps.geometry.spherical.interpolate(currentCenter, midpoint, 2.0);
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
    return offset == 0;
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
  if (ringNum == 0) {
    return center;
  }
  // Hybrid iterative/explicit; follow a spoke, then the ring's edge.

  // Find the right spoke...
  var sideNum = Math.floor(offset/ringNum);
  var spokeAngle = sideNum*60;
  // Follow the spoke...
  var edgeStart = center;
  for(var i=0; i < ringNum; i++) {
    edgeStart = getNextCenter(edgeStart, spokeAngle, steps);
  }

  // Follow the edge...
  var edgeAngle = spokeAngle+120;
  // If ring 2, offset 2, don't translate from edge at all.
  var hexLoc = edgeStart;
  for(var j=0; j < (offset%ringNum); j++) {
    hexLoc = getNextCenter(hexLoc, edgeAngle, steps);
  }
  return hexLoc;
}

function* hexGridCenters(center, steps, maxRings) {
  yield center;
  if (maxRings == 0) {
    return;
  }
  // for (var ringNum=1; ringNum < maxRings+1; ringNum++) {
  //   // Setup the first hex of the ring.
  //   var ringStart = getNextCenter(lastRingStart, 0, steps);
  //   lastRingStart = ringStart
  //   yield ringStart;
  //   var center = lastRingStart
  //   for (var angle=120; angle <= 420; angle = angle+60) {
  //     var sideLength = ringNum;
  //     if (angle > 360) {
  //       sideLength -= 1;
  //     }
  //     for (var i=0; i < sideLength; i++) {
  //       center = getNextCenter(center, angle, steps);
  //       yield center;
  //     }
  //   }
  // }
  for (var ringNum = 1; ringNum <= maxRings; ringNum++) {
    for (var offset=0; offset < hexGridMaxOffset(ringNum); offset++) {
      yield hexGridIdToCoord(center, steps, ringNum, offset);
    }
  }
}

function renderHexGrid(center, map, steps) {
  for(const hexCenter of hexGridCenters(center, steps, 5)) {
    const path = getHex(hexCenter, steps);
    map.data.add({
      geometry: new google.maps.Data.Polygon([path])
    })
  }
}
