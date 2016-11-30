/*
 * Lazy Line Painter
 * SVG Stroke animation.
 *
 * https://github.com/camoconnell/lazy-line-painter
 * http://www.camoconnell.com
 *
 * Licensed under the MIT license.
 *
 */

(function($) {

    'use strict';

    var dataKey = 'lazyLinePainter';
    var methods = {

        /**
         * init
         * Public function responsible for caching user defined options,
         * creating svg element and setting dimensions.
         * @public
         * @param  {object} _options user defined options
         */
        init: function(_options) {

            return this.each(function() {

                var $this = $(this);
                var data = $this.data(dataKey);
                $this.addClass('lazy-line');

                // If the plugin hasn't been initialized yet
                if (!data) {

                    // Collect settings, define defaults
                    var options = $.extend({
                        'width': null,
                        'height': null,
                        'strokeWidth': 2,
                        'strokeColor': '#000',
                        'strokeOverColor': null,
                        'strokeCap': 'round',
                        'strokeJoin': 'round',
                        'strokeOpacity': 1,
                        'arrowEnd': 'none',
                        'onComplete': null,
                        'onStart': null,
                        'delay': null,
                        'overrideKey': null,
                        'drawSequential': true,
                        'speedMultiplier': 1,
                        'reverse': false,
                        'responsive': false
                    }, _options);

                    // Set up path information
                    // if overrideKey has been defined - use overrideKey as key within the svgData object.
                    // else - use the elements id as key within the svgData object.
                    var target = options.overrideKey ? options.overrideKey : $this.attr('id').replace('#', '');
                    var w = options.svgData[target].dimensions.width;
                    var h = options.svgData[target].dimensions.height;

                    // target stroke path
                    options.svgData = options.svgData[target].strokepath;

                    // Create svg element and set dimensions
                    if (options.width === null) {
                        options.width = w;
                    }
                    if (options.height === null) {
                        options.height = h;
                    }
                    if (!options.responsive) {
                        $this.css({
                            'width': options.width,
                            'height': options.height
                        });
                    }

                    // create svg
                    var svg = getSVGElement('0 0 ' + w + ' ' + h);
                    options.svg = $(svg);
                    $this.append(options.svg);

                    // cache options
                    $this.data(dataKey, options);
                }
            });
        },


        /**
         * paint
         * Public function responsible for drawing path.
         * @public
         */
        paint: function() {

            return this.each(function() {

                // retrieve data object
                var $this = $(this);
                var data = $this.data(dataKey);

                var init = function() {

                    // Build array of path objects
                    data.paths = [];
                    data.longestDuration = 0;
                    data.playhead = 0;

                    var duration = 0;
                    var i = 0;

                    // find totalDuration,
                    // required before looping paths for setting up reverse options.
                    var totalDuration = 0;
                    for (i = 0; i < data.svgData.length; i++) {
                        duration = data.svgData[i].duration * data.speedMultiplier;
                        totalDuration += duration;
                    }

                    // loop paths
                    // obtain path length, animation duration and animation start time.
                    for (i = 0; i < data.svgData.length; i++) {

                        var path = getPath(data, i);
                        var length = path.getTotalLength();
                        path.style.strokeDasharray = length + ' ' + length;
                        path.style.strokeDashoffset = length;
                        path.style.display = 'block';
                        path.getBoundingClientRect();

                        duration = data.svgData[i].duration * data.speedMultiplier;
                        if (duration > data.longestDuration) {
                            data.longestDuration = duration;
                        }

                        var drawStartTime;
                        if (data.reverse) {
                            totalDuration -= duration;
                            drawStartTime = totalDuration;
                        } else {
                            drawStartTime = data.playhead;
                        }

                        data.paths.push({
                            'duration': duration,
                            'drawStartTime': drawStartTime,
                            'path': path,
                            'length': length
                        });
                        data.playhead += duration;
                    }

                    // begin animation
                    data.totalDuration = (data.drawSequential) ? data.playhead : data.longestDuration;
                    data.rAF = requestAnimationFrame(function(timestamp) {
                        draw(timestamp, data);
                    });

                    // fire onStart callback
                    if (data.onStart !== null) {
                        data.onStart();
                    }
                };

                // if delay isset
                if (data.delay === null) {
                    init();
                } else {
                    setTimeout(init, data.delay);
                }
            });
        },


        /**
         * pauseResume
         * Public function responsible for pausing / resuming path animation.
         * @public
         */
        pauseResume: function() {

            return this.each(function() {

                var data = $(this).data(dataKey);

                if (!data.paused) {
                    data.paused = true;

                    // cancel rAF
                    cancelAnimationFrame(data.rAF);
                } else {
                    data.paused = false;

                    // resume rAF
                    requestAnimationFrame(function(timestamp) {
                        adjustStartTime(timestamp, data);
                    });
                }
            });
        },


        /**
         * erase
         * Public function responsible for clearing path,
         * paint can still be called on the element after it has been erased.
         * @public
         */
        erase: function() {

            return this.each(function() {

                // retrieve data object
                var $this = $(this);
                var data = $this.data(dataKey);

                // reset / cancel rAF
                data.startTime = null;
                data.elapsedTime = null;
                cancelAnimationFrame(data.rAF);

                // empty contents of svg
                data.svg.empty();
            });
        },


        /**
         * destroy
         * Public function responsible for removing lazyline data and element from DOM
         * @public
         */
        destroy: function() {

            return this.each(function() {

                // retrieve / remove data object
                var $this = $(this);
                $this.removeData(dataKey);

                // remove container element
                $this.remove();
            });
        }
    };


    /**
     * adjustStartTime
     * Private function responsible for managing time.
     * @private
     * @param  {number} timestamp identifies current time
     * @param  {object} data      contains options set on init() and paint()
     */
    var adjustStartTime = function(timestamp, data) {
        data.startTime = timestamp - data.elapsedTime;
        requestAnimationFrame(function(timestamp) {
            draw(timestamp, data);
        });
    };


    /**
     * draw
     * Private function responsible for animating paths.
     * Path incrementation is performed using requestAnimationFrame.
     * @private
     * @param  {number} timestamp   identifies current time
     * @param  {object} data        contains options set on init() and paint()
     */
    var draw = function(timestamp, data) {

        // set startTime
        if (!data.startTime) {
            data.startTime = timestamp;
        }

        // set elapsedTime
        data.elapsedTime = timestamp - data.startTime;

        // loop paths
        for (var i = 0; i < data.paths.length; i++) {

            // set pathElapsedTime
            var pathElapsedTime;
            if (data.drawSequential) {
                pathElapsedTime = data.elapsedTime - data.paths[i].drawStartTime;
                if (pathElapsedTime < 0) {
                    pathElapsedTime = 0;
                }
            } else {
                pathElapsedTime = data.elapsedTime;
            }

            // don't redraw paths that are finished or paths that aren't up yet
            if (pathElapsedTime < data.paths[i].duration && pathElapsedTime > 0) {

                var frameLength = pathElapsedTime / data.paths[i].duration * data.paths[i].length;

                // animate path in certain direction, based on data.reverse property
                if (data.reverse || data.svgData[i].reverse) {
                    data.paths[i].path.style.strokeDashoffset = -data.paths[i].length + frameLength;
                } else {
                    data.paths[i].path.style.strokeDashoffset = data.paths[i].length - frameLength;
                }
            } else if (pathElapsedTime > data.paths[i].duration) {
                data.paths[i].path.style.strokeDashoffset = 0;
            }
        }

        // envoke draw function recursively if elapsedTime is less than the totalDuration
        if (data.elapsedTime < data.totalDuration) {
            data.rAF = requestAnimationFrame(function(timestamp) {
                draw(timestamp, data);
            });

            // else envoke onComplete
        } else {
            if (data.onComplete !== null) {
                data.onComplete();
            }
        }
    };


    /**
     * getPath
     * Private function responsible for creating a svg path element,
     * and setting attributes on path.
     * @private
     * @param  {object} data contains options set on init
     * @param  {number} i    path index
     * @return {object} path svg path element
     */
    var getPath = function(data, i) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var $path = $(path);
        data.svg.append($path);
        $path.attr(getAttributes(data, data.svgData[i]));
        return path;
    };


    /**
     * getAttributes
     * Private function which returns an object of path attributes,
     * selects either global options set on init or specific path option
     * @private
     * @param  {object} data  contains options set on init()
     * @param  {object} value contains specific path options
     * @return {object}       obj of path attributes
     */
    var getAttributes = function(data, value) {
        return {
            'd': value.path,
            'stroke': !value.strokeColor ? data.strokeColor : value.strokeColor,
            'fill-opacity': 0,
            'stroke-opacity': !value.strokeOpacity ? data.strokeOpacity : value.strokeOpacity,
            'stroke-width': !value.strokeWidth ? data.strokeWidth : value.strokeWidth,
            'stroke-linecap': !value.strokeCap ? data.strokeCap : value.strokeCap,
            'stroke-linejoin': !value.strokeJoin ? data.strokeJoin : value.strokeJoin
        };
    };


    /**
     * getSVGElement
     * Private function which returns empty svg element,
     * with specified viewBox aspect ratio.
     * @private
     * @param  {string} viewBox
     * @return {obj}    svg
     */
    var getSVGElement = function(viewBox) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttributeNS(null, 'viewBox', viewBox);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return svg;
    };


    /**
     * lazylinepainter
     * Public function which extends jQuery's prototype object.
     * @public
     * @param  {string}     method  Expects lazylinepainter method name as string.
     * @return {function}           Returns lazylinepainter method.
     */
    $.fn.lazylinepainter = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            console.log('opps - issue finding method');
        }
    };

})(jQuery);

$(document).ready(function($){
	
	// svg one start ******************************
	var pathObj = {
		"svg1": {
			"strokepath": [
				{
					"path": "M39.397,56.739",
					"duration": 600
				},
				{
					"path": "M 39.397,57.68 L 47.702,48.041   64.204,44.927 120.905,53.61 147.878,117.616 117.251,168.966 100.876,174.278 98.241,174.391 ",
					"duration": 600
				},
				{
					"path": "M 47.577,48.04 L 101.877,56.013   131.551,119.596 97.922,174.917 ",
					"duration": 600
				},
				{
					"path": "M93.656,49.437l58.988-5.053  c0,0,39.215,6.428,42.445,46.689c3.281,40.867-17.287,48.234-21.788,49.935c-4.506,1.702-46.524,11.991-46.524,11.991",
					"duration": 600
				},
				{
					"path": "M174.925,71.427L174.925,71.427c1.777,0.001,4.457,1.781,6.139,5.183c0.925,1.867,1.342,3.886,1.146,5.539   c-0.098,0.82-0.438,2.271-1.616,2.794c-0.277,0.123-0.587,0.186-0.92,0.185c-1.781,0-4.462-1.781-6.143-5.18   c-1.943-3.93-1.311-7.547,0.47-8.335C174.278,71.49,174.59,71.427,174.925,71.427 M174.925,69.96c-0.554,0-1.087,0.104-1.581,0.323   c-2.858,1.266-3.402,5.868-1.221,10.285c1.807,3.649,4.91,6.027,7.549,6.028c0.553,0,1.086-0.104,1.581-0.324   c2.855-1.263,3.4-5.869,1.217-10.284C180.662,72.34,177.56,69.961,174.925,69.96L174.925,69.96z",
					"duration": 500
				},
				{
					"path": "M43.026,72.26c9.051,0.004,18.62,5.826,26.258,15.973c7.531,10.004,12.023,22.886,12.018,34.459   c-0.005,11.652-3.065,21.185-8.85,27.569c-5.542,6.114-13.6,9.345-23.302,9.34c-9.135-0.004-18.63-5.422-26.051-14.864   c-7.48-9.515-11.766-21.646-11.76-33.286c0.005-11.891,3.007-21.843,8.684-28.785C25.591,75.853,33.547,72.255,43.026,72.26    M43.026,70.303c-20.713-0.01-33.746,16.07-33.757,41.146c-0.012,25.078,19.167,50.097,39.88,50.106s34.209-13.786,34.221-38.863   C83.381,97.617,63.737,70.313,43.026,70.303L43.026,70.303z",
					"duration": 500
				},
				{
					"path": "M88.684,124.329c-0.013,28.168-15.19,43.67-38.477,43.659  c-23.286-0.011-44.853-28.12-44.84-56.293C5.381,83.523,20.037,65.459,43.323,65.47c3.116,0.001,6.21,0.553,9.233,1.572  C72.125,73.646,88.696,99.928,88.684,124.329z",
					"duration": 600
				},
				{
					"path": "M72.001,55.574",
					"duration": 600
				},
				{
					"path": "M 52.993,67.19 L 53.997,59.112 73.1,56 ",
					"duration": 600
				},
				{
					"path": "M29.998,54.369",
					"duration": 600
				},
				{
					"path": "M 57.724,69.27 L 58.896,60.345 77.501,57.704 ",
					"duration": 200
				},
				{
					"path": "M 64.453,73.67 L 70.045,67.205 86.097,64.588 ",
					"duration": 200
				},
				{
					"path": "M 68.58,77.31 L 73.418,71.253 90.168,68.388 ",
					"duration": 200
				},
				{
					"path": "M 75.511,85.37 L 82.09,80.599 99.692,77.325 ",
					"duration": 200
				},
				{
					"path": "M 78.691,90.19 L 86.31,85.384 103.415,81.909 ",
					"duration": 200
				},
				{
					"path": "M 83.983,100.8 L 93.633,96.213 109.311,95.008 ",
					"duration": 200
				},
				{
					"path": "M 86.077,105.66 L 95.081,101.792 110.701,100.288 ",
					"duration": 200
				},
				{
					"path": "M 88.173,116.75 L 98.895,113.903 113.077,112.92 ",
					"duration": 200
				},
				{
					"path": "M 88.684,124.32 L 98.892,121.187 113.599,120.932 ",
					"duration": 200
				},
				{
					"path": "M 88.005,134.14 L 98.884,136.418 112.569,131.885 ",
					"duration": 200
				},
				{
					"path": "M 86.975,139.43 L 97.104,141.525 112.566,137.371 ",
					"duration": 200
				},
				{
					"path": "M 83.96,149.27 L 92.807,152.982 106.159,149.947 ",
					"duration": 200
				},
				{
					"path": "M 81.754,152.97 L 90.127,157.224 103.858,154.014 ",
					"duration": 200
				},
				{
					"path": "M 74.734,160.00 L 83.953,164.789 95.603,161.011 ",
					"duration": 200
				},
				{
					"path": "M 71.417,162.39 L 79.329,169.126 93.925,164.794 ",
					"duration": 200
				},
				{
					"path": "M 63.173 166.15 L 66.144 174.901",
					"duration": 200
				},
				{
					"path": "M 59.091,167.16 L 61.344,174.899 66.144,174.901 ",
					"duration": 200
				},
				{
					"path": "M 51.548,167.98 L 52.544,175.936 60.874,173.284 ",
					"duration": 200
				},
				{
					"path": "M 47.005,167.15 L 47.517,175.934 52.544,175.936 ",
					"duration": 200
				},
				{
					"path": "M38.13,165.501c-0.101,0.144-0.987,7.21-0.987,7.21l9.861-2.644",
					"duration": 200
				},
				{
					"path": "M 34.063,163.53 L 32.845,170.534 37.142,172.711 ",
					"duration": 200
				},
				{
					"path": "M 26.509,158.23 L 24.371,163.239 31.343,161.892 ",
					"duration": 200
				},
				{
					"path": "M 22.854,154.77 L 19.648,159.979 24.249,163.533 ",
					"duration": 200
				},
				{
					"path": "M 16.401,146.76 L 12.053,149.902 18.252,149.365 ",
					"duration": 200
				},
				{
					"path": "M 13.679,142.36 L 9.253,145.834 11.462,150.257 ",
					"duration": 200
				},
				{
					"path": "M 7.658,127.90 L 2.462,129.75 4.06,134.104 9.089,132.361 ",
					"duration": 200
				},
				{
					"path": "M 5.368,111.44 L 1.269,111.445 1.266,116.176 5.548,116.178   ",
					"duration": 200
				},
				{
					"path": "M 6.605,101.37 L 1.274,98.775 1.277,93.898 7.539,96.79 ",
					"duration": 200
				},
				{
					"path": "M 8.829 92.443 L 1.277 93.898",
					"duration": 200
				},
				{
					"path": "M8.145,79.681l3.592,3.582l-1.569,3.006l-4.114-4.147L8.145,79.681 M8.084,78.198L4.682,82.17l5.754,5.799   l2.547-4.884L8.084,78.198L8.084,78.198z",
					"duration": 200
				},
				{
					"path": "M 8.084 78.198 L 16.548 76.928",
					"duration": 200
				},
				{
					"path": "M 16.548,76.92 L 12.989,70.289 16.092,66.661 20.954,73.658   ",
					"duration": 200
				},
				{
					"path": "M25.823,64.466c-0.952,0.211-9.731,2.196-9.731,2.196",
					"duration": 200
				},
				{
					"path": "M 29.169,58.62 L 25.403,60.329 27.9,69.511 ",
					"duration": 200
				},
				{
					"path": "M31.388,67.732c-0.1-0.095-2.217-9.105-2.217-9.105l10.228-1.888",
					"duration": 200
				},
				{
					"path": "M 39.394 65.647 L 39.397 57.686",
					"duration": 200
				},
				{
					"path": "M 43.719,65.4 L 43.898,57.688 61.6,53.724 ",
					"duration": 200
				},
				{
					"path": "M 66.056 174.642 L 74.246 172.728",
					"duration": 200
				},
				{
					"path": "M 43.898 57.688 L 39.397 57.686",
					"duration": 200
				},
				{
					"path": "M25.402,61.58",
					"duration": 200
				},
				{
					"path": "M 66.056 174.901 L 98.866 174.917",
					"duration": 200
				}
			],
			"dimensions": {
				"width": 200,
				"height": 190
			}
		}
	}; 

	/*  Setup and Paint your lazyline! */ 
	 $('#svg1').lazylinepainter( 
	 {
		"svgData": pathObj,
		"strokeWidth": 2,
		"strokeColor": "#fff"
	}).lazylinepainter('paint'); 

	// svg two start *********************************
	var pathObj = {
		"svg2": {
			"strokepath": [
				{
					"path": "M73.271,3.771c7.025,0,14.107,0.34,21.053,1.009c20.895,2.015,33.813,12.32,41.529,18.478   c3.188,2.542,5.291,4.222,7.1,4.584c1.441,0.288,1.82,0.558,1.076,4.76c-0.188,1.061-0.381,2.158-0.445,3.265   c-0.291,4.898-7.4,105.448-8.824,118.3c-1.121,10.097-2.682,11.477-4.662,13.226c-0.514,0.455-1.096,0.97-1.699,1.626   c-0.385,0.415-0.752,0.914-1.182,1.492c-3.252,4.394-10.861,14.679-48.773,17.04c-3.105,0.193-6.144,0.291-9.034,0.291   c-30.712,0-40.289-10.677-43.436-14.185c-0.5-0.556-0.829-0.923-1.191-1.196c-0.25-0.188-0.54-0.394-0.859-0.62   c-1.981-1.408-4.978-3.535-4.978-6.154V165.5l-0.035-0.185C17.725,159.152,3.978,41.313,3.486,37.091   c-0.011-0.767-0.113-1.606-0.23-2.571c-0.635-5.222-1.594-13.107,10.952-20.371C28.322,7.553,49.841,3.771,73.271,3.771    M73.271,1.803c-23.107,0-45.113,3.631-59.974,10.6C-2.896,21.736,1.52,32.708,1.52,37.212c0,0,14.231,122.086,15.458,128.475   c0,4.137,4.661,6.877,6.625,8.35c1.817,1.366,10.148,15.773,45.806,15.773c2.87,0,5.919-0.094,9.155-0.296   c43.426-2.702,48.334-15.967,51.279-19.162c2.943-3.194,5.398-2.701,6.871-15.966c1.469-13.266,8.584-114.227,8.832-118.404   c0.244-4.176,2.697-9.088-2.209-10.072c-4.906-0.982-19.271-20.24-48.826-23.09C87.445,2.14,80.305,1.803,73.271,1.803    M137.949,123.372l-0.672-0.717c-18.002,16.929-53.557,18.98-80.214,17.727c-27.765-1.309-40.848-11.478-42.831-14.131l-0.787,0.59   c2.042,2.73,15.423,13.197,43.573,14.522c4.013,0.189,8.225,0.305,12.553,0.305C94.184,141.668,122.426,137.971,137.949,123.372    M132.889,167.062l-0.484-0.857c-54.828,31.057-110.396,4.523-110.95,4.251l-0.432,0.885c0.353,0.173,22.828,10.913,53.271,10.913   C92.051,182.253,112.52,178.599,132.889,167.062 M144.889,32.713l-0.811-1.792c-9.91,4.502-36.227,16.463-87.797,13.708   c-2.153-0.115-3.853-0.207-4.984-0.207c-3.118,0-6.921-0.634-10.947-1.304c-6.865-1.146-14.646-2.441-21.05-0.834   c-8.387,2.108-11.935-0.222-14.525-1.922c-0.325-0.212-0.629-0.413-0.923-0.589l-1.019,1.684c0.274,0.166,0.56,0.354,0.864,0.553   c2.73,1.792,6.86,4.504,16.082,2.184c6.006-1.507,13.572-0.247,20.249,0.866c4.108,0.686,7.989,1.333,11.269,1.333   c1.079,0,2.757,0.091,4.879,0.203c3.823,0.204,9.344,0.5,16.089,0.5C90.637,47.094,118.072,44.903,144.889,32.713 M68.28,152.902   v6.041c0,1.503-1.109,2.475-2.823,2.475c-1.143,0-1.834-0.283-2.359-0.964c-0.529,0.681-1.22,0.964-2.363,0.964   c-1.714,0-2.821-0.971-2.821-2.475v-6.041h1.08v5.902c0,1.043,0.585,1.551,1.791,1.551c1.143,0,1.771-0.516,1.771-1.451v-6.002   h1.082v6.002c0,0.936,0.629,1.451,1.771,1.451c1.205,0,1.791-0.508,1.791-1.551v-5.902H68.28z M91.941,155.398v3.464   c0,1.231-0.904,2.556-2.891,2.556h-1.422c-1.986,0-2.893-1.324-2.893-2.556v-3.464c0-1.232,0.908-2.558,2.902-2.558h1.398   C91.031,152.841,91.941,154.166,91.941,155.398 M90.861,155.537c0-1.038-0.68-1.631-1.861-1.631h-1.322   c-1.18,0-1.859,0.593-1.859,1.631v3.185c0,1.054,0.662,1.634,1.859,1.634H89c1.182,0,1.861-0.596,1.861-1.634V155.537z    M98.404,153.827c-0.525-0.682-1.219-0.963-2.359-0.963c-1.715,0-2.824,0.97-2.824,2.472v6.043h1.082v-5.901   c0-1.045,0.586-1.552,1.791-1.552c1.143,0,1.77,0.515,1.77,1.452v6.001h1.082v-6.001c0-0.938,0.627-1.452,1.771-1.452   c1.203,0,1.791,0.507,1.791,1.552v5.9h1.08v-6.042c0-1.502-1.109-2.473-2.824-2.473C99.621,152.864,98.93,153.146,98.404,153.827    M80.547,152.841c-1.988,0-2.893,1.325-2.893,2.558v3.465c0,1.23,0.904,2.555,2.893,2.555h1.23c1.01,0,1.672-0.146,2.203-0.493   l0.068-0.045l-0.617-0.902l-0.066,0.039c-0.396,0.242-0.898,0.34-1.73,0.34h-1.039c-1.199,0-1.861-0.58-1.861-1.634v-3.185   c0-1.053,0.664-1.631,1.861-1.631h1.039c0.832,0,1.332,0.098,1.73,0.338l0.066,0.039l0.617-0.902l-0.068-0.045   c-0.531-0.346-1.191-0.495-2.203-0.495L80.547,152.841L80.547,152.841z M72.541,152.841c-0.958,0-1.412,0.106-1.91,0.297   l-0.086,0.035l0.54,0.963l0.066-0.025c0.368-0.151,0.769-0.204,1.531-0.204h0.811c1.182,0,1.859,0.593,1.859,1.631v3.185   c0,1.038-0.677,1.634-1.859,1.634h-1.32c-1.211,0-1.801-0.492-1.801-1.504c0-1.003,0.59-1.491,1.801-1.491h1.84v-1.062h-1.891   c-1.8,0-2.832,0.934-2.832,2.563c0,1.576,1.085,2.555,2.832,2.555h1.422c1.985,0,2.892-1.324,2.892-2.555v-3.465   c0-1.232-0.906-2.558-2.892-2.558L72.541,152.841L72.541,152.841z M128.725,24.363c-0.941-0.643-1.914-1.309-2.703-2.042   c-9.646-8.976-28.785-13.918-53.889-13.918c-6.682,0-13.892,0.345-21.429,1.025c-8.047,0.724-32.466,5-38.926,14.792   c-2.892,4.385-3.752,7.737-2.555,9.965c1.054,1.962,3.696,2.865,7.513,2.592c0.58-0.042,1.309-0.063,2.169-0.063   c5.131,0,14.303,0.909,24.012,1.673c10.124,0.795,20.592,1.805,26.718,1.805h0.002c0.489,0,0.947-0.192,1.378-0.204   c4.653-0.117,13.866-0.541,23.862-1.433c0.018,0.025,0.045,0.001,0.061,0.027l0.131-0.114c13.906-1.248,29.283-3.595,36.037-7.958   c0.902-0.679,1.332-1.387,1.314-2.15C132.385,26.875,130.607,25.652,128.725,24.363 M70.989,39.004   c-0.422,0.011-0.874,0.202-1.353,0.202h-0.002c-4.994,0-12.922-0.739-21.187-1.376c0.348-0.324,1.163-0.944,3.075-1.541   c10.702-3.339,36.124-3.481,42.456,1.413C84.332,38.531,75.504,38.891,70.989,39.004 M130.543,29.692   c-6.357,4.106-20.693,6.383-34.057,7.644c-5.33-7.389-35.564-6.134-45.548-3.02c-2.844,0.888-4.339,1.902-4.646,3.16   c-1.099-0.086-2.201-0.172-3.3-0.258c-9.729-0.766-18.917-1.489-24.088-1.489c-0.884,0-1.638,0.022-2.239,0.066   c-0.431,0.031-0.847,0.046-1.249,0.046c-1.911,0-4.387-0.368-5.329-2.124c-0.999-1.856-0.13-4.954,2.509-8.956   c6.247-9.47,30.271-13.64,38.193-14.354C58.3,9.73,65.48,9.386,72.132,9.386c24.854,0,43.754,4.85,53.262,13.692   c0.799,0.745,1.803,1.432,2.773,2.098c1.596,1.091,3.246,2.22,3.27,3.201C131.445,28.795,131.137,29.244,130.543,29.692",
					"duration": 30000
				}
			],
			"dimensions": {
				"width": 148,
				"height": 190
			}
		}
	}; 
	 
	/* Setup and Paint your lazyline! */ 
	 $('#svg2').lazylinepainter( 
		 {
			"svgData": pathObj,
			"strokeWidth": 1,
			"strokeColor": "#131313"
		})
	.lazylinepainter('paint'); 
});
