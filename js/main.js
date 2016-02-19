(function () {
    var app = angular.module("vis", ["vis.tree"]);

    var width = 1200,
        height = 1000;

    var content = d3.select("body").append("div").attr("id", "content");

    var svg = content.append("svg")
        .attr("id", "canvas")
        .attr("width", width)
        .attr("height", height)
        .call(d3.behavior.zoom().on("zoom", function () {
            svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
        }))
        .append("g");

    var legendBox = content.append("svg")
        .attr("id", "legend");

    var legend = legendBox.selectAll(".legend")
        .data(["Registered", "Discovered", "Created", "DefaultsApplied", "Initialized", "Mutated", "Finalized", "SelfClosed", "GraphClosed"]);

    var legendGroup = legend.enter()
        .append("g")
        .attr("class", "legend");

    var legendCircle = legendGroup.append("circle")
        .attr("r", 6)
        .attr("cx", 8)
        .attr("cy", function(d, idx) {
            return 10 + idx * 18;
        })
        .attr("class", function (d) { return d; });

    var legendText = legendGroup.append("text")
        .attr("x", 20)
        .attr("y", function(d, idx) {
            return 13 + idx * 18;
        })
        .text(function(d) {
            return d;
        });
    legend.exit().remove();

    var dataFile = location.hash ? location.hash.substring(1) : "samples/gradle-model.json";

    app.factory("dataLoader", function ($q) {
        return function (dataFile) {
            console.log("Loading data file", dataFile);
			return $q(function (resolve, reject) {
                d3.json(dataFile, function(error, events) {
                    if (error) {
                        reject(error);
                    } else {
                        console.log("Loaded data file", dataFile);
                        resolve(events);
                    }
                });
			});
        };
    });

    app.controller("TimeController", function($scope, $timeout, dataLoader, LayoutFactory) {
        $scope.time = 0;
        $scope.commands = [];
        $scope.playing = false;
        $scope.stepTime = function (delta) {
            var time = parseInt($scope.time) + delta;
            if (time >= 0 && time < $scope.commands.length) {
                $scope.time = time;
                $scope.$digest();
            }
        };
        dataLoader(dataFile).then(function (events) {
            var layout = new LayoutFactory(svg, d3, width, height);
            $scope.commands = processEvents(events, layout);
            $scope.$watch("time", function (targetTime, time) {
                redrawUntil(parseInt(targetTime), parseInt(time));
            });
            $scope.$watch("playing", function (playing) {
                if (playing) {
                    var playLoop = function() {
                        if ($scope.playing && $scope.time < $scope.commands.length - 1) {
                            $scope.time++;
                            $timeout(playLoop, 200);
                        } else {
                            $scope.playing = false;
                        }
                        $scope.$digest();
                    };
                    $timeout(playLoop, 0);
                }
            });

            var redrawUntil = function(targetTime, time) {
                if (time < targetTime) {
                    while (time < targetTime) {
                        $scope.commands[time].forward();
                        time++;
                    }
                } else {
                    while (time > targetTime) {
                        time--;
                        $scope.commands[time].backward();
                    }
                }
                layout.repaint();
            }
        });
    });

    var processEvents = function (events, layout) {
        var existingNodes = {};
        var commands = [];
        var multiproject = Object.size(events.groupBy(function (e) { return e.project; })) > 1;
        var normalizeEvent = function(event) {
            if (!multiproject) {
                return;
            }
            if (event.project != '') {
               var path = '<ROOT '+event.project+'>';
               if (event.path != '') { path += '.' + event.path; }
               event.path = path;
            }
        }
        var processEvent = function(event) {
            normalizeEvent(event);
            var existingNode = existingNodes[event.path];
            if (existingNode) {
                var nextState = event.state;
                var previousState = existingNode.state;
                commands.push({
                    forward: function() {
                        console.log("-> " + event.path + ": " + previousState + " -> " + nextState);
                        layout.setState(event.path, nextState);
                    },
                    backward: function() {
                        console.log("<- " + event.path + ": " + nextState + " -> " + previousState);
                        layout.setState(event.path, previousState);
                    }
                });
                existingNode.state = event.state;
            } else {
                commands.push({
                    forward: function() {
                        console.log("++ " + event.path);
                        layout.addNode(event.path);
                    },
                    backward: function() {
                        console.log("-- " + event.path);
                        layout.removeNode(event.path);
                    }
                });
                existingNodes[event.path] = {
                    path: event.path,
                    state: event.state
                };
            }
        };
        if (multiproject) {
        processEvent({ "project": '', "path": '', state: 'Registered'});
        events.forEach(function (event) {
            if (!existingNodes['<ROOT '+event.project+'>']) {
                  processEvent({ project:'', state: 'Registered', path: '<ROOT '+event.project+'>' });
            }
        });
        }
        events.forEach(processEvent);
        return commands;
    };
})();
