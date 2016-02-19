var init = function() {
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
    console.log("Loading data file", dataFile);

    d3.json(dataFile, function(error, events) {
        if (error) throw error;

        var layout = new TreeLayout(svg, d3, width, height);

        var commands = processEvents(events, layout);
        var time = 0;

        $("#time").attr({
            min: 0,
            max: events.length
        }).val(0);
        $("#back").click(function() {
            var value = parseInt($("#time").val());
            value = Math.max(0, value - 1);
            $("#time").val(value);
            $("#time").trigger("input");
        });
        $("#forward").click(function() {
            var value = parseInt($("#time").val());
            value = Math.min(events.length, value + 1);
            $("#time").val(value);
            $("#time").trigger("input");
        });
        var playing = false;
        var $playPause = $("#play-pause");
        $playPause.click(function() {
            var stop = function() {
                playing = false;
                $playPause.text(">>");
            };
            if (!playing) {
                var playLoop = function() {
                    var $time = $("#time");
                    var cur = parseInt($time.val());
                    var max = parseInt($time.attr('max'));
                    if (cur < max) {
                        $("#forward").trigger("click");
                        if (playing) setTimeout(playLoop, 200);
                    } else {
                        stop();
                    }
                };
                playing = true;
                $playPause.text("||");
                playLoop();
            } else {
                stop();
            }
        });

        var redrawUntil = function(targetTime) {
            if (time < targetTime) {
                while (time < targetTime) {
                    commands[time].forward();
                    time++;
                }
            } else {
                while (time > targetTime) {
                    time--;
                    commands[time].backward();
                }
            }
            layout.repaint();
        }

        $("#time").on("input", function() {
            redrawUntil(parseInt($(this).val()));
        });
    });
};

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
