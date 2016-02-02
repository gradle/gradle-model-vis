var ForceLayout = function(d3, width, height) {
    var force = d3.layout.force()
        .charge(-120)
        .linkDistance(80)
        .size([width, height]);
    var nodes = force.nodes(),
        links = force.links();

    var findNodeIndex = function(path) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].name == path) {
                return i;
            }
        };
    };

    var addLink = function(source, target, value) {
        var sourceIdx = findNodeIndex(source);
        var sourceNode = nodes[sourceIdx];
        if (!sourceNode) {
            throw "No source node for " + source;
        }
        var targetIdx = findNodeIndex(target);
        var targetNode = nodes[targetIdx];
        if (!targetNode) {
            throw "No target node for " + target;
        }
        links.push({
            "source": sourceNode,
            "target": targetNode,
            "value": value
        });
    };

    var removeLink = function(source, target) {
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (link.source.id == source && link.target.id == target) {
                links.splice(i, 1);
                break;
            }
        }
    };

    // Add and remove elements on the graph object
    this.addNode = function(path, parentPath) {
        nodes.push({
            "name": path,
            "state": "Registered"
        });
        if (path) {
            var idx = path.lastIndexOf('.');
            var parentPath = idx === -1 ? "" : path.substring(0, idx);
            addLink(path, parentPath, 1);
        }
    };

    this.removeNode = function(path) {
        var i = 0;
        var nodeIndex = findNodeIndex(path);
        var node = nodes[nodeIndex];
        while (i < links.length) {
            var link = links[i];
            if (link.source == node || link.target == node) {
                links.splice(i, 1);
            } else {
                i++;
            }
        }
        nodes.splice(nodeIndex, 1);
    };

    this.setState = function(path, state) {
        var node = nodes[findNodeIndex(path)];
        node.state = state;
    };

    this.repaint = function() {
        var link = svg.selectAll(".link")
            .data(links);

        link.enter().append("line")
            .attr("class", "link")
            .style("stroke-width", function(d) {
                return Math.sqrt(d.value);
            });
        link.exit().remove();

        var node = svg.selectAll(".node")
            .data(nodes);

        var nodeGroup = node.enter()
            .append("g")
            .attr("class", "node");

        var nodeCircle = nodeGroup.append("circle")
            .attr("r", function(d) {
                if (!d.name) {
                    return 10;
                } else {
                    return 8;
                }
            })
            .call(force.drag);

        var nodeText = nodeGroup.append("text")
            .text(function(d) {
                var name = d.name;
                var idx = name.lastIndexOf(".");
                if (idx !== -1) {
                    name = name.substring(idx + 1);
                }
                return name ? name : "<ROOT>";
            })
            .attr("x", "9")
            .attr("y", "3")
            .style("fill", "#000000");
        node.exit().remove();

        force.on("tick", function() {
            node
                .attr("transform", function(d) {
                    var transform = "translate(" + d.x + "," + d.y + ")";
                    return transform;
                });

            nodeCircle
                .attr("class", function (d) { return d.state; });

            link
                .attr("x1", function(d) {
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    return d.target.y;
                });
        });

        // Restart the force layout.
        force.start();
    };
};
