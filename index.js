/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-env es6, browser */
(function() {
    "use strict";
    var rava = {};
    var tagSelectors = new Map();

    var matches = Element.prototype.matches
            || Element.prototype.msMatchesSelector;
    var forEach = NodeList.prototype.forEach || Array.prototype.forEach;

    rava.bind = function(selector, config) {
        var tagSet = tagSelectors.get(selector);
        if (!tagSet) {
            tagSet = new Set();
            tagSelectors.set(selector, tagSet);
        }
        tagSet.add(config);
        forEach.call(document.querySelectorAll(selector), function(node) {
            wrap(node, selector, config);
        });
    };

    rava.find = function(element, selector) {
        traverse(element, function(el) {
            if (matches.call(el, selector)) {
                return el;
            }
        });
        return null;
    }

    rava.findAll = function(element, selector) {
        var response = [];
        traverse(element, function(el) {
            if (matches.call(el, selector)) {
                response.push(el);
            }
        });
        return response;
    }

    new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            traverseNodeList(mutation.addedNodes, added);
            traverseNodeList(mutation.removedNodes, removed);
        });
    }).observe(document.body, {
        attributes : false,
        childList : true,
        subtree : true,
        characterData : false
    });

    var traverseNodeList = function(nodeList, callback) {
        forEach.call(nodeList, function(node) {
            if (node.nodeType == Node.ELEMENT_NODE) {
                traverse(node, callback);
            }
        });
    };

    var traverse = function(element, callback) {
        var checkSet = new Set();
        checkSet.add(element);
        checkSet.forEach(function(el) {
            callback(el);
            for (var i = 0; i < el.children.length; i++) {
                checkSet.add(el.children[i]);
            }
            checkSet["delete"](el);
        });
    };

    var added = function(element) {
        tagSelectors.forEach(function(sets, selector) {
            if (matches.call(element, selector)) {
                sets.forEach(function(config) {
                    if (matches.call(element, selector)) {
                        wrap(element, selector, config);
                    }
                });
            }
        });
    };

    var removed = function(element) {
        if (!element["x-rava"]) {
            return;
        }
        element["x-rava"].forEach(function(config) {
            if (config.callbacks && config.callbacks.removed) {
                config.callbacks.removed.call(element);
            }
            return;
        });
    };

    var wrap = function(node, selector, config) {
        if (config.scoped){
            if(!config.target.contains(node)){
                return;
            }
        }
        var configSet = node["x-rava"];
        if (!configSet) {
            configSet = new Set();
            node["x-rava"] = configSet;
        }
        if (configSet.has(config)) {
            if (config.callbacks && config.callbacks.added) {
                config.callbacks.added.call(node);
            }
            return;
        }
        configSet.add(config);

        Object.getOwnPropertyNames(config).forEach(function(name) {
            if (name === "constructor") {
                return;
            }
            if (name === "events") {
                registerEventHandlers(node, config, selector);
            }
            if (name === "methods") {
                handleMethods(node, config[name]);
            }
        });
        if (config.callbacks) {
            if (config.callbacks.created) {
                config.callbacks.created.call(node);
            }
            if (config.callbacks.added) {
                config.callbacks.added.call(node);
            }
        }
    };

    var handleMethods = function(node, funcs) {
        for ( var funcName in funcs) {
            node[funcName] = funcs[funcName].bind(node);
        }
    };

    var registerEventHandlers = function(node, config, selector) {
        var events = config.events;
        var data = config.data;
        var target = config.target || node;
        for ( var eventName in events) {
            var possibleFunc = events[eventName];
            if (typeof possibleFunc !== "object") {
                node.addEventListener(eventName, getEventHandler(possibleFunc, target, data));
            } else {
                var newConfig = {};
                newConfig.scoped = eventName.trim().startsWith(':scope');
                newConfig.target = node;
                newConfig.events = possibleFunc;
                newConfig.data = data;
                var extendedSelector = eventName.replace(':scope',selector).trim();
                rava.bind(extendedSelector, newConfig);
            }
        }
    };

    var getEventHandler = function(func, target, data){
        return function(event){
            func.call(target,event,data);
        };
    };

    if (typeof define === 'function' && define.amd) {
        define(rava);
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            rava : rava
        };
    } else {
        window.rava = rava;
    }
})();
