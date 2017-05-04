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
  // Hybrid iterative/explicit; follow a spoke, then the ring's edge.

  // Find the right spoke...
  var sideNum = getHexSideNum(ringNum, offset);
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

function renderRegion(map, center, steps, hexes, color) {
  var path = regionPath(center, steps, hexes);
  path.forEach(function (hex) {
    map.data.add({
      geometry: new google.maps.Data.Polygon([hex]),
      properties: {color: color}
    });
  });
}

function renderHexGrid(center, map, steps) {
  for(const hexCenter of hexGridCenters(center, steps, 5)) {
    const path = getHex(hexCenter, steps);
    map.data.add({
      geometry: new google.maps.Data.Polygon([path]),
      properties: {color: '#222222'}
    });
  }
}

// TODO: Finish implementing this.
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
//       filledHexCoord = Object.assign(hexCoord, {sides:[0,1,2,3,4,5]}
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
//           // FIXME: Implement this.
//           // `joinSide == sideNum(outsideCoord) + 4` ?
//         }
//         if (insideCoord.offset === Math.ceil(translatedOffset)) {
//           // We have a match!
//           // FIXME: Implement this.
//           // `joinSide == sideNum(outsideCoord) + 3` ?
//         }
//       }
//       else if(currRing - existingRing === -1) {
//         var insideCoord = filledHexCoord;
//         var outsideCoord = existingCoord;
//         var translatedOffset = outsideCoord.offset * insideCoord.ring/outsideCoord.ring;
//         if (insideCoord.offset === Math.floor(translatedOffset)) {
//           // We have a match!
//           // FIXME: Implement this.
//           // `joinSide == sideNum(outsideCoord) + 4` ?
//         }
//         if (insideCoord.offset === Math.ceil(translatedOffset)) {
//           // We have a match!
//           // FIXME: Implement this.
//           // `joinSide == sideNum(outsideCoord) + 3` ?
//         }
//       }
//     }
//   }
// }
//
// function mergeHexes(hex1, hex2, joiningSideNum) {
//   hex1.sides.splice(hex1.sides.indexOf(joiningSideNum), 1)
//   const altJoiningSideNum = (joiningSideNum + 3) % 6
//   hex2.sides.splice(hex2.sides.indexOf(altJoiningSideNum), 1)
// }
