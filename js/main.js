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
        $scope.steps = [];
        $scope.playing = false;
        $scope.stepTime = function (delta) {
            var time = parseInt($scope.time) + delta;
            if (time >= 0 && time <= $scope.steps.length) {
                $scope.time = time;
            }
        };
        $scope.states = ["Registered", "Discovered", "Created", "DefaultsApplied", "Initialized", "Mutated", "Finalized", "SelfClosed", "GraphClosed"];
        $scope.count = function(time) {
            if (time < 0 || time >= $scope.steps.length === 0) {
                return 0;
            }
            return $scope.states.reduce(function (count, state) {
                return count + $scope.steps[time].stateCounts[state];
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
            $scope.steps = processEvents(events, layout, $scope.states);
            $scope.$watch("time", function (targetTime, time) {
                redrawUntil(parseInt(targetTime), parseInt(time));
            });
            $scope.$watch("playing", function (playing) {
                if (playing) {
                    var playLoop = function() {
                        if ($scope.playing && $scope.time < $scope.steps.length - 1) {
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
                        $scope.steps[time].command.forward();
                        time++;
                    }
                } else {
                    while (time > targetTime) {
                        time--;
                        $scope.steps[time].command.backward();
                    }
                }
                layout.repaint();
            }
        });
    });

    var processEvents = function (events, layout, states) {
        var existingNodes = {};
        var steps = [];
        var projects = Object.keys(events.groupBy(function (e) { return e.project; }));
        var normalizePath = function(project, path) {
            if (projects.length === 1) {
                return path;
            }
            var normalizedPath = '['+ project + ']';
            if (path !== "") {
                normalizedPath += '.' + path;
            }
            return normalizedPath;
        };
        var processEvent = function(event, previousStateCounts) {
            var path = normalizePath(event.project, event.path);
            var stateCounts = Object.clone(previousStateCounts);
            var previousState = existingNodes[path];
            var command;
            var description;
            if (previousState) {
                var nextState = event.state;
                if (nextState === previousState) {
                    return;
                }

                stateCounts[nextState]++;
                stateCounts[previousState]--;
                description = "'" + path + "' now in " + nextState + " (was: " + previousState + ")",
                command = {
                    forward: function() {
                        console.log("-> " + path + ": " + previousState + " -> " + nextState);
                        layout.setState(path, nextState);
                    },
                    backward: function() {
                        console.log("<- " + path + ": " + nextState + " -> " + previousState);
                        layout.setState(path, previousState);
                    }
                };
            } else {
                stateCounts[event.state]++;
                description = "'" + path + "' added  in " + event.state,
                command = {
                    forward: function() {
                        console.log("++ " + path);
                        layout.addNode(path);
                    },
                    backward: function() {
                        console.log("-- " + path);
                        layout.removeNode(path);
                    }
                };
            }
            existingNodes[path] = event.state;
            return {
                description: description,
                command: command,
                stateCounts: stateCounts
            };
        };

        var stateCounts = {};
        states.forEach(function (state) {
            stateCounts[state] = 0;
        });

        projects.forEach(function (project) {
            var path = normalizePath(project, "");
            existingNodes[path] = "Registered";
            stateCounts["Registered"]++;
            layout.addNode(path);
        });

        events.forEach(function (event) {
            var step = processEvent(event, stateCounts);
            if (step) {
                stateCounts = step.stateCounts;
                steps.push(step);
            }
        });
        return steps;
    };
})();
