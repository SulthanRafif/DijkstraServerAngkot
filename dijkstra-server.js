const express = require('express');
const app = express();
const cors = require('cors');
const port = 3002;
const bodyParser = require('body-parser');

app.use(cors()); // Mengizinkan semua asal
app.use(express.json());

app.use(express.json({ limit: '100mb' })); // Menggunakan express bawaan
app.use(express.urlencoded({ limit: '100mb', extended: true })); // Untuk URL-encoded data


class Graph {
    static lines = new Map();
    static interchanges = new Map();
    static points = new Map();
    static pathPoints = new Map();
    static oneMeterInDegree = 0.00000898448;

    static buildLine(idline, points) {
        console.log('build line id line ', idline)

        // let line = Graph.lines.get(idline);
        // line.points = points;
        // line.path = Graph.createPath(points);
        // for (let i = 0; i < line.points.length; i++)
        //     Graph.points.set(line.points[i].idpoint, line.points[i]);
        // for (let i = 0; i < line.path.length; i++)
        //     Graph.pathPoints.set(line.path[i].idpoint, line.path[i]);

        // console.log('build line Graph Points server ', Graph.points)
    }

    static buildInterconnections() {
        console.log('interchanges graph server ', Graph.interchanges)

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
        console.log('point of getNearestPoint server ', point)
        console.log('graph points server ', Graph.points)

        let distance = Number.MAX_VALUE;
        let nearestPoint = null;
        Graph.points.forEach((p, k) => {
            let d = Graph.distance(p, point);

            // console.log('for each getNearestPoint server')

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
        // console.log('source dijkstra server ', source);

        Dijkstra.visited = new Set();
        Dijkstra.unvisited = new Set();
        source.cost = {
            cost: 0,
            distance: 0
        }
        Dijkstra.unvisited.add(source);
        while (Dijkstra.unvisited.size > 0) {

            // console.log('Dijkstra Unvisited server ', Dijkstra.unvisited);

            let current = Dijkstra.getMinimumCostPoint(Dijkstra.unvisited);

            console.log('current dijkstra server ', current);

            console.log('current dijkstra destination server ', current.destinations);

            current.destinations.forEach((dest, key) => {
                // console.log('dest server ', dest)

                // console.log('key server ', key)

                let nextPoint = Graph.pathPoints.get(key);
                if (nextPoint == undefined) console.log(key, current, dest, Graph.pathPoints);
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
        console.log('get minimum cost point server ', unvisited)

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
            evPoint.cheapestPath.push(currentPoint);
        }
    }
}

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' http://localhost:3002");
    next();
});

// Middleware untuk parsing JSON
app.use(express.json());

// Gunakan middleware CORS
app.use(cors());

// Endpoint linePromises
app.get('/api/getLinePromises', (req, res) => {
    const linepromises_data = req.query.linepromises_data
    const idlines = req.query.idlines
    // const linePromises = req.query.linePromises

    console.log('line data lines server ', linepromises_data)
    console.log('line data idlines ', idlines)
    // console.log('line linePromises ', linePromises)

    // console.log('type of data lines server ', typeof linepromises_data)

    Graph.buildLine(idlines.shift())
})


// Endpoint get lat lng source
app.get('/api/getLatLngSource', (req, res) => {
    const latSource = req.query.latSource
    const lngSource = req.query.lngSource

    // console.log('lat source server ', latSource)
    // console.log('lng source server ', lngSource)

    let source = Graph.getNearestPoint({
        lat: latSource,
        lng: lngSource
    });

    console.log('source graph server ', source)
})

app.get('/api/getGraphPoint', (req, res) => {
    const get_graph_points = req.query.graph_points;

    console.log('graph points ', get_graph_points)
})

// Endpoint get source
app.get('/api/getSource', (req, res) => {
    const source = req.query.source_isi;
    const destination = req.query.destination_isi;

    console.log('source get source server ', source);
    console.log('source get destination server ', destination);

    Graph.pathPoints.set(source.idpoint, source);
    Graph.pathPoints.set(destination.idpoint, destination);

    console.log('path points nya server ', Graph.pathPoints)

    // Graph.buildInterconnections();

    // Dijkstra.getCheapestPath(source);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})