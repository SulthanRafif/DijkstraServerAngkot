const cors = require('cors');
const express = require('express');
const port = 3003;
const app = express();
const axios = require('axios')

app.use(cors());

class App {
    static steps = [];
    static stepPolylines = new Map();
    static markers = new Map();

    static buildNavigationSteps(
        destination,
        pathSteps,
        latStartMarker,
        lngStartMarker,
        latEndMarker,
        lngEndMarker,
    ) {
        let color = null;
        let idline = null;
        let path = [];
        pathSteps.push(destination);
        App.steps = [];
        App.stepPolylines.forEach((polyline, k) => {
            polyline.setMap(null);
            App.stepPolylines.delete(k);
        });
        App.markers.forEach((marker, key) => {
            marker.setMap(null);
            App.markers.delete(key);
        });
        for (let i = 0; i < pathSteps.length; i++) {
            let step = pathSteps[i];
            if (idline == null) {
                color = step.linecolor;
                idline = step.idline;
                path.push({
                    idpoint: step.idpoint,
                    lat: parseFloat(step.lat),
                    lng: parseFloat(step.lng)
                });
                App.steps.push({
                    type: 'walk',
                    from: {
                        lat: latStartMarker,
                        lng: lngStartMarker
                    },
                    to: { lat: parseFloat(step.lat), lng: parseFloat(step.lng) }
                });
                continue;
            } else {
                if (step.idline == idline) {
                    path.push({
                        idpoint: step.idpoint,
                        lat: parseFloat(step.lat),
                        lng: parseFloat(step.lng)
                    });
                    continue;
                } else {
                    let prevStep = App.steps[App.steps.length - 1];
                    if (prevStep.type == 'line') {
                        App.steps.push({
                            type: 'walk',
                            from: prevStep.to,
                            to: path[0]
                        });
                    }
                    let line = Graph.lines.get(idline);

                    let p = [];
                    let draw = false;
                    line.points.data.forEach(point => {
                        if (point.idpoint == path[0].idpoint) draw = true;
                        if (draw) {
                            p.push({
                                lat: parseFloat(point.lat),
                                lng: parseFloat(point.lng)
                            });
                        }
                        if (point.idpoint == path[path.length - 1].idpoint) draw = false;
                    });
                    App.steps.push({
                        type: 'line',
                        idline: idline,
                        strokeColor: color,
                        from: path[0],
                        to: path[path.length - 1],
                        distance: Graph.pathDistance(p)
                    });

                    color = step.linecolor;
                    idline = step.idline;
                    path = [];
                    path.push({
                        idpoint: step.idpoint,
                        lat: parseFloat(step.lat),
                        lng: parseFloat(step.lng)
                    });
                }
            }
        };
        if (path.length) {
            let prevStep = App.steps[App.steps.length - 1];
            if (prevStep.type == 'line') {
                App.steps.push({
                    type: 'walk',
                    from: prevStep.to,
                    to: path[0]
                });
            }
            let line = Graph.lines.get(idline);
            let p = [];
            let draw = false;

            line.points.data.forEach(point => {
                if (point.idpoint == path[0].idpoint) draw = true;
                if (draw) {
                    p.push({
                        lat: parseFloat(point.lat),
                        lng: parseFloat(point.lng)
                    });
                }
                if (point.idpoint == path[path.length - 1].idpoint) draw = false;
            });
            App.steps.push({
                type: 'line',
                idline: idline,
                strokeColor: color,
                from: path[0],
                to: path[path.length - 1],
                distance: Graph.pathDistance(p)
            });
            prevStep = App.steps[App.steps.length - 1];
            if (prevStep.type == 'line') {
                App.steps.push({
                    type: 'walk',
                    from: App.steps[App.steps.length - 1].to,
                    to: {
                        lat: latEndMarker,
                        lng: lngEndMarker
                    }
                });
            }
        }
        return App.steps;
    }

    static getLines() {
        return Promise.all([
            axios.get('http://localhost:3000/api/interchanges')
                .then(response => {
                    response.data.forEach(i => {
                        let idpoints = [];
                        if (i.idpoints != null) idpoints = i.idpoints.split(",");

                        Graph.interchanges.set(i.idinterchange, idpoints);
                    });
                }),
            axios.get('http://localhost:3000/api/lines')
                .then(response => {
                    const data = response.data;

                    let linePromises = [];
                    let idlines = []

                    data.forEach(line => {
                        if (parseInt(line.count)) {
                            Graph.lines.set(line.idline, line);

                            linePromises.push(
                                axios.get(`http://localhost:3000/api/lines/${line.idline}`)
                            );
                            idlines.push(line.idline);
                        }
                    });

                    return Promise.all(linePromises).then(linepoints => {
                        linepoints.forEach(points => {
                            Graph.buildLine(idlines.shift(), points)
                        });
                    });
                })
        ]);
    }
}


class Graph {
    static lines = new Map();
    static interchanges = new Map();
    static points = new Map();
    static pathPoints = new Map();
    static oneMeterInDegree = 0.00000898448;

    static buildLine(idline, points) {
        let line = Graph.lines.get(idline);
        line.points = points;
        line.path = Graph.createPath(points.data);
        for (let i = 0; i < line.points.data.length; i++) {

            Graph.points.set(line.points.data[i].idpoint, line.points.data[i]);
        }

        for (let i = 0; i < line.path.length; i++) {
            Graph.pathPoints.set(line.path[i].idpoint, line.path[i]);
        }
    }

    static buildInterconnections() {
        Graph.interchanges.forEach(ic => {

            let pics = [];
            ic.forEach(pic => pics.push(Graph.pathPoints.get(pic)));
            pics.forEach(picSource => {
                pics.forEach(picDestination => {
                    if (picSource == undefined || picDestination == undefined) return;
                    if (picSource.idpoint === picDestination.idpoint) return;
                    picSource.destinations.set(picDestination.idpoint, {
                        cost: 4000,
                        distance: Math.sqrt(Math.pow(parseFloat(picSource.lat) - parseFloat(picDestination.lat), 2) +
                            Math.pow(parseFloat(picSource.lng) - parseFloat(picDestination.lng), 2)) / Graph.oneMeterInDegree
                    });
                    picDestination.sources.set(picSource.idpoint, {
                        cost: 4000,
                        distance: Math.sqrt(Math.pow(parseFloat(picSource.lat) - parseFloat(picDestination.lat), 2) +
                            Math.pow(parseFloat(picSource.lng) - parseFloat(picDestination.lng), 2)) / Graph.oneMeterInDegree
                    })
                });
            });
        });
    }

    static createPath(points) {
        let path = [], prevPoint = null;
        let distance = 0;

        for (let i = 0; i < points.length; i++) {
            let point = points[i];

            if (prevPoint == null) {
                point.destinations = new Map();
                point.sources = new Map();
                point.cost = {
                    distance: Number.MAX_VALUE,
                    cost: Number.MAX_VALUE
                }
                point.cheapestPath = [];
                path.push(point);
                prevPoint = point;

                continue;
            }
            distance += (Graph.distance(point, prevPoint) / Graph.oneMeterInDegree);
            if (point.idinterchange || i == points.length - 1 || point.isStop) {
                point.cost = {
                    distance: Number.MAX_VALUE,
                    cost: Number.MAX_VALUE
                }
                point.destinations = new Map();
                point.sources = new Map();
                point.sources.set(path[path.length - 1].idpoint, {
                    cost: 0,
                    distance: distance
                });
                point.cheapestPath = [];
                let pvPoint = path[path.length - 1];
                pvPoint.destinations.set(point.idpoint, {
                    cost: 0,
                    distance: distance
                });
                path.push(point);
                distance = 0;
            }
            prevPoint = point;
        };
        return path;
    }

    static distance(pointA, pointB) {
        return Math.sqrt(Math.pow(pointA.lat - pointB.lat, 2) +
            Math.pow(pointA.lng - pointB.lng, 2)) / Graph.oneMeterInDegree
    }

    static pathDistance(path) {
        let d = 0;
        let pp = null;
        path.forEach(p => {
            if (pp == null) {
                pp = p;
                return;
            }
            d += (Graph.distance(pp, p));
            pp = p;
        });
        return d;
    }

    static getNearestPoint(point) {
        let distance = Number.MAX_VALUE;
        let nearestPoint = null;

        Graph.points.forEach((p, k) => {
            let d = Graph.distance(p, point);

            if (d < distance) {
                distance = d;
                nearestPoint = p;
            }
        });
        return nearestPoint;
    }
}

class Dijkstra {
    static visited = new Set();
    static unvisited = new Set();

    static getCheapestPath(source) {
        Dijkstra.visited = new Set();
        Dijkstra.unvisited = new Set();
        source.cost = {
            cost: 0,
            distance: 0
        }
        Dijkstra.unvisited.add(source);
        while (Dijkstra.unvisited.size > 0) {
            let current = Dijkstra.getMinimumCostPoint(Dijkstra.unvisited);

            current.destinations.forEach((dest, key) => {
                let nextPoint = Graph.pathPoints.get(key);
                if (nextPoint == undefined)
                    if (!Dijkstra.visited.has(nextPoint)) {
                        Dijkstra.calculateMinPrice(nextPoint, dest, current);
                        Dijkstra.unvisited.add(nextPoint);
                    }
            });
            Dijkstra.unvisited.delete(current);
            Dijkstra.visited.add(current);
        }
    }

    static getMinimumCostPoint(unvisited, by = 'COST') {
        let minimumCost = {
            cost: Number.MAX_VALUE,
            distance: Number.MAX_VALUE
        };
        let lowestPoint = null;
        switch (by) {
            case 'COST':
                unvisited.forEach(point => {
                    if (point.cost.cost < minimumCost.cost) {
                        minimumCost = point.cost;
                        lowestPoint = point;
                    }
                });
                return lowestPoint;
        }
    }

    static calculateMinPrice(evPoint, edgeCost, currentPoint) {
        let sourceCost = currentPoint.cost;

        if (sourceCost.cost + edgeCost.cost < evPoint.cost.cost) {
            evPoint.cost.cost = sourceCost.cost + edgeCost.cost;
            evPoint.cheapestPath = [];
            currentPoint.cheapestPath.forEach(p => {
                evPoint.cheapestPath.push(p);
            })
        }
    }
}

app.get('/api/getLatLng', (req, res) => {
    const latSource = parseFloat(req.query.latSource);
    const lngSource = parseFloat(req.query.lngSource);

    const latDest = parseFloat(req.query.latDest);
    const lngDest = parseFloat(req.query.lngDest);

    App.getLines().then(() => {
        let source = Graph.getNearestPoint({
            lat: latSource,
            lng: lngSource
        });

        let destination = Graph.getNearestPoint({
            lat: latDest,
            lng: lngDest
        });

        source.isStop = true;
        destination.isStop = true;
        destination.cost = {
            cost: Number.MAX_VALUE,
            distance: Number.MAX_VALUE
        };

        Graph.lines.forEach(line => {
            line.path = Graph.createPath(line.points.data);
        });

        Graph.pathPoints.set(source.idpoint, source);
        Graph.pathPoints.set(destination.idpoint, destination);

        Graph.buildInterconnections();

        Dijkstra.getCheapestPath(source);

        let steps = App.buildNavigationSteps(
            destination,
            Graph.pathPoints.get(destination.idpoint).cheapestPath,
            latSource,
            lngSource,
            latDest,
            lngDest
        );

        console.log('steps ', steps)

        // console.log('cheapest path ', Graph.pathPoints.get(destination.idpoint).cheapestPath);
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error processing request');
    });
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})