var TreeLayout = function(d3, width, height) {
    var root = {
        name: "",
        state: "Registered",
        children: []
    };

    var diameter = Math.min(width, height);

    var tree = d3.layout.tree()
        .size([360, diameter / 2 - 120])
        .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });

    var diagonal = d3.svg.diagonal.radial()
        .projection(function(d) {
            return [d.y, d.x / 180 * Math.PI];
        });

    var canvas = svg
        .append("g")
        .attr("transform", "translate(" + (diameter / 2) + "," + diameter / 2 + ")");

    var findChildIndex = function(parent, name) {
        for (var i = 0; i < parent.children.length; i++) {
            if (parent.children[i].name == name) {
                return i;
            }
        };
        return -1;
    };
    var findNode = function (path) {
        var node = root;
        if (path !== "") {
            var parts = path.split(/\./);
            while (parts.length > 0) {
                var name = parts.shift();
                var childIndex = findChildIndex(node, name);
                node = node.children[childIndex];
            }
        }
        return node;
    };

    // Add and remove elements on the graph object
    this.addNode = function(path) {
        if (!path) {
            return;
        }
        var idx = path.lastIndexOf('.');
        var parentPath = idx === -1 ? "" : path.substring(0, idx);
        var name = idx === -1 ? path : path.substring(idx + 1);
        var parent = findNode(parentPath);
        parent.children.push({
            name: name,
            parent: parentPath,
            state: "Registered",
            children: []
        });
    };

    this.removeNode = function(path) {
        if (!path) {
            return;
        }
        var idx = path.lastIndexOf('.');
        var parentPath = idx === -1 ? "" : path.substring(0, idx);
        var name = idx === -1 ? path : path.substring(idx + 1);
        var parent = findNode(parentPath);
        var childIndex = findChildIndex(parent, name);
        if (childIndex !== -1) {
            parent.children.splice(childIndex, 1);
        }
    };

    this.setState = function(path, state) {
        var node = findNode(path);
        node.state = state;
    };

    this.repaint = function () {
        var svg = canvas;
        svg.selectAll('.node').remove();
        svg.selectAll('.link').remove();
        var nodes = tree.nodes(JSON.parse(JSON.stringify(root)));
        var links = tree.links(nodes);

        var link = svg.selectAll(".link")
            .data(links);
        link
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("d", diagonal);

        var node = svg.selectAll(".node")
            .data(nodes);
        var nodeGroup = node
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })

        nodeGroup.append("circle")
            .attr("r", function(d) {
                if (!d.name) {
                    return 8;
                } else {
                    return 6;
                }
            })
            .style("fill", function(d) {
                return stateColors[d.state];
            })
            .style("stroke", function(d) {
                if (!d.name) {
                    return "black";
                }
                return "none";
            });

        nodeGroup.append("text")
            .attr("dy", ".31em")
            .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
            .attr("transform", function(d) { return d.x < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
            .text(function(d) {
                var name = d.name;
                var idx = name.lastIndexOf(".");
                if (idx !== -1) {
                    name = name.substring(idx + 1);
                }
                return name ? name : "ROOT";
            })
            .style("fill", "#000000");
    };
};
