(function () {
    var app = angular.module("vis", ["vis.tree"]);

    var width = 1200,
        height = 1000;

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

    app.controller("MainController", function($scope, $timeout, dataLoader, LayoutFactory) {
        $scope.time = 0;
        $scope.commands = [];
        $scope.playing = false;
        $scope.stepTime = function (delta) {
            var time = parseInt($scope.time) + delta;
            if (time >= 0 && time <= $scope.commands.length) {
                $scope.time = time;
            }
        };
        $scope.states = ["Registered", "Discovered", "Created", "DefaultsApplied", "Initialized", "Mutated", "Finalized", "SelfClosed", "GraphClosed"];
        $scope.stateCounts = {};
        $scope.states.forEach(function (state) {
            $scope.stateCounts[state] = 0;
        });
        $scope.count = function() {
            return $scope.states.reduce(function (count, state) {
                return count + $scope.stateCounts[state];
            }, 0);
        };

        var svg = d3.select("#canvas")
            .attr("id", "canvas")
            .attr("width", width)
            .attr("height", height)
            .call(d3.behavior.zoom().on("zoom", function () {
                svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
            }))
            .append("g");

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
                        $scope.commands[time].forward($scope.stateCounts);
                        time++;
                    }
                } else {
                    while (time > targetTime) {
                        time--;
                        $scope.commands[time].backward($scope.stateCounts);
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
                    description: "'" + event.path + "' now in " + nextState + " (was: " + previousState + ")",
                    forward: function(stateCounts) {
                        console.log("-> " + event.path + ": " + previousState + " -> " + nextState);
                        stateCounts[nextState]++;
                        stateCounts[previousState]--;
                        layout.setState(event.path, nextState);
                    },
                    backward: function(stateCounts) {
                        console.log("<- " + event.path + ": " + nextState + " -> " + previousState);
                        stateCounts[nextState]--;
                        stateCounts[previousState]++;
                        layout.setState(event.path, previousState);
                    }
                });
                existingNode.state = event.state;
            } else {
                commands.push({
                    description: "'" + event.path + "' added  in " + event.state,
                    forward: function(stateCounts) {
                        console.log("++ " + event.path);
                        stateCounts[event.state]++;
                        layout.addNode(event.path);
                    },
                    backward: function(stateCounts) {
                        console.log("-- " + event.path);
                        stateCounts[event.state]--;
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
