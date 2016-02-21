(function () {
    var module = angular.module("vis.tree", []);

    module.factory("LayoutFactory", function () {
        return function (svg, d3, width, height) {
            var createNode = function (name, parentPath, hidden) {
                var children = [];
                var node = {
                    name: name,
                    parent: parentPath,
                    hidden: hidden,
                    state: "Registered",
                    addChild: function (childName, hidden) {
                        var path = parentPath ? parentPath + "." + name : name;
                        children.push(createNode(childName, path, hidden));
                        children.sort(function (a, b) { return a.name.localeCompare(b.name); });
                        node.children = children;
                    }
                };
                return node;
            }

            var cloneNonHiddenNode = function (node) {
                var children;
                if (node.children) {
                    children = node.children
                    .filter(function (child) { return !child.hidden; })
                    .map(cloneNonHiddenNode);
                } else {
                    children = [];
                }
                return {
                    name: node.name,
                    parent: node.parent,
                    state: node.state,
                    children: children
                };
            }

            var root = createNode("", null, false);

            var tree = d3.layout.tree()
                .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / (a.depth + 1); });

            var diagonal = d3.svg.diagonal.radial()
                .projection(function(d) {
                    return [d.y, d.x / 180 * Math.PI];
                });

            var canvas = svg
                .append("g")
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

            var findChildIndex = function(parent, name) {
                if (!parent.children) {
                    return -1;
                }
                for (var i = 0; i < parent.children.length; i++) {
                    if (parent.children[i].name == name) {
                        return i;
                    }
                };
                return -1;
            };
            var findNodeInternal = function (path) {
                var node = root;
                if (path !== "") {
                    var parts = path.split(/\./);
                    while (parts.length > 0) {
                        var name = parts.shift();
                        var childIndex = findChildIndex(node, name);
                        if (childIndex === -1) {
                            return null;
                        }
                        node = node.children[childIndex];
                    }
                }
                return node;
            };
            var findNode = function (path) {
                var node = findNodeInternal(path);
                if (node === null) {
                    throw "Cannot find node " + path;
                }
                return node;
            };

            this.hasNode = function (path) {
                return findNodeInternal(path) !== null;
            }

            // Add and remove elements on the graph object
            this.addNode = function(path, hidden) {
                if (!path) {
                    return;
                }
                var idx = path.lastIndexOf('.');
                var parentPath = idx === -1 ? "" : path.substring(0, idx);
                var name = idx === -1 ? path : path.substring(idx + 1);
                var parent = findNode(parentPath);
                parent.addChild(name, hidden);
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

            var getMaxDepth = function (node, currentDepth) {
                var depth = currentDepth;
                if (node.children) {
                    node.children.forEach(function (child) {
                        depth = Math.max(depth, getMaxDepth(child, currentDepth + 1))
                    });
                }
                return depth;
            }

            this.repaint = function (showHidden) {
                var displayRoot;
                if (showHidden) {
                    displayRoot = root;
                } else {
                    displayRoot = cloneNonHiddenNode(root);
                }

                var maxDepth = getMaxDepth(displayRoot, 0);
                tree.size([360, maxDepth * 100]);
                var svg = canvas;
                svg.selectAll('.node').remove();
                svg.selectAll('.link').remove();

                var nodes = tree.nodes(displayRoot);
                var links = tree.links(nodes);

                var link = svg.selectAll(".link")
                    .data(links);
                link
                    .enter()
                    .append("path")
                    .attr("class", function (d) {
                        if (d.target.hidden) {
                            return "link isHidden";
                        } else {
                            return "link";
                        }
                    })
                    .attr("d", diagonal);

                var node = svg.selectAll(".node")
                    .data(nodes);
                var nodeGroup = node
                    .enter()
                    .append("g")
                    .attr("class", function (d) {
                        if (d.hidden || d.hidden) {
                            return "node isHidden";
                        } else {
                            return "node";
                        }
                    })
                    .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })

                nodeGroup.append("circle")
                    .attr("r", 6)
                    .attr("class", function(d) { return d.state; });

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
                    });
            };
        };
    });
})();
