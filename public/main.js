mapboxgl.accessToken =
                'pk.eyJ1IjoibG92ZWRvY3RvcjM2OSIsImEiOiJjbHI1eDBhamkwM2NpMnFvczd2ODIyN2QzIn0.IJsSWOjDJyqyv2McyXizag';
            // instantiates a new map
            const map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/light-v11',
                projection: 'globe', // Display the map as a globe, since satellite-v9 defaults to Mercator
                zoom: 17,
                center: [-118.148451, 34.066285], // longitute, latitude
                antialias: true // create the gl context with MSAA antialiasing, so custom layers are antialiased
            });

            // eslint-disable-next-line no-undef
            const tb = (window.tb = new Threebox(
                map,
                map.getCanvas().getContext('webgl'),
                {
                    defaultLights: true
                }
            ));

            // create the popup
            const popup = new mapboxgl.Popup({ offset: 25 }).setText(
                'Local 7/11.'
            );

            // Create a default Marker and add it to the map.
            new mapboxgl.Marker({
                color: '#ff0000'
            })
                .setLngLat([-118.149148, 34.068001])  //7-11
                .setPopup(popup) // sets a popup on this marke
                .addTo(map);

            // global variables
            let ruler = false;
            let drone;
			let drone2;

            const distanceContainer = document.getElementById('distance');

            // GeoJSON object to hold our measurement features
            const geojson = {
                type: 'FeatureCollection',
                features: []
            };

            // Used to draw a line between points
            const linestring = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            };
			
			class BoxCustomLayer {
				type = 'custom';
				renderingMode = '3d';

				constructor(id) {
					this.id = id;
				}

				async onAdd(map, gl) {
					//this.camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 1e6);
					// this.camera = new THREE.Camera();

					//const centerLngLat = map.getCenter();
					//this.center = MercatorCoordinate.fromLngLat(centerLngLat, 0);
					//const {x, y, z} = this.center;
					//	const s = this.center.meterInMercatorCoordinateUnits();

					//const scale = new THREE.Matrix4().makeScale(s, s, -s);
					//const rotation = new THREE.Matrix4().multiplyMatrices(
					//		new THREE.Matrix4().makeRotationX(-0.5 * Math.PI),
					//	new THREE.Matrix4().makeRotationY(Math.PI));
					
					//this.cameraTransform = new THREE.Matrix4().multiplyMatrices(scale, rotation).setPosition(x, y, z);

					this.map = map;
					this.scene = this.makeScene();

					// use the Mapbox GL JS map canvas for three.js
					this.renderer = new THREE.WebGLRenderer({
					  canvas: map.getCanvas(),
					  context: gl,
					  antialias: true,
					});

					this.renderer.autoClear = false;

					this.raycaster = new THREE.Raycaster();
					this.raycaster.near = -1;
					this.raycaster.far = 1e6;
				  }

				  makeScene() {
					const scene = new THREE.Scene();
					const skyColor = 0xb1e1ff; // light blue
					const groundColor = 0xb97a20; // brownish orange

					scene.add(new THREE.AmbientLight(0xffffff, 0.25));
					scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.25));

					const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
					directionalLight.position.set(-70, -70, 100).normalize();
					// Directional lights implicitly point at (0, 0, 0).
					scene.add(directionalLight);

					const group = new THREE.Group();
					group.name = '$group';

					const geometry = new THREE.BoxGeometry( 100, 100, 100 );
					geometry.translate(0, 50, 0);
					const material = new THREE.MeshPhongMaterial({
					  color: 0xff0000,
					});
					const cube = new THREE.Mesh( geometry, material );

					group.add(cube);
					scene.add(group);

					return scene;
				  }

				  //render(gl, matrix) {
					//this.camera.projectionMatrix = new THREE.Matrix4()
					//  .fromArray(matrix)
					//  .multiply(this.cameraTransform);
					//this.renderer.state.reset();
					//this.renderer.render(this.scene, this.camera);
				  //}

				  raycast(point, isClick) {
					var mouse = new THREE.Vector2();
					 // // scale mouse pixel position to a percentage of the screen's width and height
					//mouse.x = ( point.x / this.map.transform.width ) * 2 - 1;
					//mouse.y = 1 - ( point.y / this.map.transform.height ) * 2;
					
					 mouse.x = (point.x / map.getCanvas().width) * 2 - 1;
					 mouse.y = -(point.y / map.getCanvas().height) * 2 + 1;
					
					//const camInverseProjection = new THREE.Matrix4().getInverse(this.camera.projectionMatrix);
					//const cameraPosition = new THREE.Vector3().applyMatrix4(camInverseProjection);
					//const mousePosition = new THREE.Vector3(mouse.x, mouse.y, 1).applyMatrix4(camInverseProjection);
					//const viewDirection = mousePosition.clone().sub(cameraPosition).normalize();    

					//this.raycaster.set(cameraPosition, viewDirection);
					
					this.raycaster.setFromCamera(mouse, tb.camera, 0, 50);
					this.raycaster.setFromCamera(mouse, tb.camera, 0, 1000);
					
					// calculate objects intersecting the picking ray
					var intersects = this.raycaster.intersectObjects(this.scene.children, true);
					$('#info').empty();
					if (intersects.length) {
					  for(let i = 0; i < intersects.length; ++i) {
						$('#info').append(' ' + JSON.stringify(intersects[i].distance));
						isClick && console.log(intersects[i]);
					  }
					  
					  isClick && $('#info').append(';');
					}
				  }
				}

			let boxLayer = new BoxCustomLayer('box');

            map.on('style.load', () => {
                map.setFog({}); // Set the default atmosphere style
                // Insert the layer beneath any symbol layer.
                const layers = map.getStyle().layers;
                const labelLayerId = layers.find(
                    (layer) =>
                        layer.type === 'symbol' && layer.layout['text-field']
                ).id;

                // The 'building' layer in the Mapbox Streets
                // vector tileset contains building height data
                // from OpenStreetMap.
                map.addLayer(
                    {
                        id: 'add-3d-buildings',
                        source: 'composite',
                        'source-layer': 'building',
                        filter: ['==', 'extrude', 'true'],
                        type: 'fill-extrusion',
                        minzoom: 15,
                        paint: {
                            'fill-extrusion-color': '#aaa',

                            // Use an 'interpolate' expression to
                            // add a smooth transition effect to
                            // the buildings as the user zooms in.
                            'fill-extrusion-height': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                15,
                                0,
                                15.05,
                                ['get', 'height']
                            ],
                            'fill-extrusion-base': [
                                'interpolate',
                                ['linear'],
                                ['zoom'],
                                15,
                                0,
                                15.05,
                                ['get', 'min_height']
                            ],
                            'fill-extrusion-opacity': 0.6
                        }
                    },
                    labelLayerId
                );

                // add a source and layers for run route
                map.addSource('alhambra', {
                    type: 'geojson',
                    data: '../data/alhambra.geojson'
                });

                // add a mapbox style layer
                map.addLayer({
                    id: 'alhambra-lines',
                    type: 'line',
                    source: 'alhambra',
                    paint: {
						//Adds the color of the line
                        'line-color': [
                            'match',
                            ['get', 'name'],
                            'run-route',
                            '#0000ff',
                            'church',
                            '#00ff00',
                            '#ffff00'
                        ],
						//Makes the width of the line
						//That's going to surround the church
                        'line-width': [
                            'match',
                            ['get', 'name'],
                            'run-route',
                            4,
                            'church',
                            4,
                            4
                        ]
                    },
                    filter: ['in', 'name', 'run-route', 'church']
                });

                map.addLayer({
                    id: 'alhambra-fills',
                    type: 'fill',
                    source: 'alhambra',
                    paint: {
                        'fill-color': [
                            'match',
                            ['get', 'name'],
                            'school',
                            '#ff00ff',
                            'run-route',
                            '#ff0000',
                            'church',
                            '#ff0000',
                            '#ffff00'
                        ],
                        'fill-opacity': [
                            'match',
                            ['get', 'name'],
                            'church',
                            0,
                            'run-route',
                            0,
                            0.5
                        ]
                    }
                });

                map.addLayer({
                    id: 'custom-threebox-model',
                    type: 'custom',
                    renderingMode: '3d',
                    onAdd: function () {
                        // Creative Commons License attribution:  Metlife Building model by https://sketchfab.com/NanoRay
                        // https://sketchfab.com/3d-models/metlife-building-32d3a4a1810a4d64abb9547bb661f7f3
                        const scale = 3.2;
                        const options = {
                            obj: '../drone/scene.gltf', //Gets the 3d model of the drone itself
                            type: 'gltf',
                            scale: { x: scale, y: scale, z: 2.7 },
                            units: 'meters',
                            rotation: { x: 90, y: -90, z: 0 }
                        };

                        tb.loadObj(options, (model) => {
                            model.setCoords([-118.148512, 34.065868]);
                            model.setRotation({ x: 0, y: 0, z: 250 });
                            tb.add(model);

                            drone = model;
                        });
                    },

                    render: function () {
                        tb.update();
                    }
                });
				
				//Adds second drone onto the field
				//This second drone will act as the detector
				map.addLayer({
                    id: 'custom-threebox-model-second',
                    type: 'custom',
                    renderingMode: '3d',
                    onAdd: function () {
                        // Creative Commons License attribution:  Metlife Building model by https://sketchfab.com/NanoRay
                        // https://sketchfab.com/3d-models/metlife-building-32d3a4a1810a4d64abb9547bb661f7f3
                        const scale = 10;
                        const options = {
                            obj: '../drone/scene.gltf', //Gets the 3d model of the drone itself
                            type: 'gltf',
                            scale: { x: scale, y: scale, z: scale },
                            units: 'meters',
                            //rotation: { x: 90, y: 0, z: 0 }
							rotation: { x: 90, y: -90, z: 0 }
                        };

                        tb.loadObj(options, (model) => {
                            model.setCoords([-118.148592, 34.065868]);
                            model.setRotation({ x: 0, y: 0, z: 250 });
                            //model.setRotation({ x: 0, y: 0, z: 0 });
                            tb.add(model);

                            drone2 = model;
                        });
                    },

                    render: function () {
                        tb.update();
                    }
                });
				
                map.addSource('geojson', {
                    type: 'geojson',
                    data: geojson
                });

                // Add styles to the map
                map.addLayer({
                    id: 'measure-points',
                    type: 'circle',
                    source: 'geojson',
                    paint: {
                        'circle-radius': 5,
                        'circle-color': '#000'
                    },
                    filter: ['in', '$type', 'Point']
                });
                map.addLayer({
                    id: 'measure-lines',
                    type: 'line',
                    source: 'geojson',
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    paint: {
                        'line-color': '#000',
                        'line-width': 2.5
                    },
                    filter: ['in', '$type', 'LineString']
                });
				
				
				
				//What happens when the user clicks with their mouse?
                map.on('click', (e) => {
					boxLayer.raycast(e.point, true);
					
                    if (ruler) {
                        const features = map.queryRenderedFeatures(e.point, {
                            layers: ['measure-points']
                        });

                        // Remove the linestring from the group
                        // so we can redraw it based on the points collection.
                        if (geojson.features.length > 1) geojson.features.pop();

                        // Clear the distance container to populate it with a new value.
                        distanceContainer.innerHTML = '';

                        // If a feature was clicked, remove it from the map.
                        if (features.length) {
                            const id = features[0].properties.id;
                            geojson.features = geojson.features.filter(
                                (point) => point.properties.id !== id
                            );
                        } else {
                            const point = {
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [e.lngLat.lng, e.lngLat.lat]
                                },
                                properties: {
                                    id: String(new Date().getTime())
                                }
                            };

                            geojson.features.push(point);
                        }

                        if (geojson.features.length > 1) {
                            linestring.geometry.coordinates =
                                geojson.features.map(
                                    (point) => point.geometry.coordinates
                                );

                            geojson.features.push(linestring);

                            // Populate the distanceContainer with total distance
                            const value = document.createElement('pre');
                            const distance = turf.length(linestring);
                            value.textContent = `Total distance: ${distance.toLocaleString()}km`;
                            distanceContainer.appendChild(value);
                        }

                        map.getSource('geojson').setData(geojson);
                    } else {
                        const features = map.queryRenderedFeatures(e.point, {
                            layers: ['alhambra-fills', 'alhambra-lines']
                        });

                        if (features.length > 0) {
                            let outputDiv = document.getElementById('output');
                            const selectedPolygon = features[0];
                            const name = selectedPolygon.properties.name;
                            outputDiv.innerHTML = name;
                        } else {
                            let outputDiv = document.getElementById('output');
                            outputDiv.innerHTML = 'None';
                        }
                    }
                });
				
				// var raycaster = new THREE.Raycaster();
				// var mouse = new THREE.Vector2();
				
				// Assuming you have a Mapbox GL JS map instance
				// map.on('click', function (event) {
					// Convert mouse coordinates to normalized device coordinates
					// mouse.x = (event.point.x / map.getCanvas().width) * 2 - 1;
					// mouse.y = -(event.point.y / map.getCanvas().height) * 2 + 1;

					// console.log(mouse.x, mouse.y);
					
					// Set up the raycaster
					//raycaster.setFromCamera(mouse, tb.camera, 0, 50);
					// raycaster.setFromCamera(mouse, tb.camera, 0, 1000);

					// Check for intersections
					// var intersects = raycaster.intersectObject(drone2, true); // Assuming 'drone2' is your 3D model
					//var intersects = raycaster.intersectObject(drone2);

					// if (intersects.length > 0) {
						// Intersection detected, perform actions
						// console.log('Intersection with 3D model:', intersects[0]);
					// }
				// });
            });

            // custom function
            function moveDrone(point) {
                drone.setCoords(linestring.geometry.coordinates[point]);
            }

            map.on('mousemove', (e) => {
				boxLayer.raycast(e.point, false);
				
                const features = map.queryRenderedFeatures(e.point, {
                    layers: ['measure-points']
                });
                // Change the cursor to a pointer when hovering over a point on the map.
                // Otherwise cursor is a crosshair.
                map.getCanvas().style.cursor = features.length
                    ? 'pointer'
                    : 'crosshair';
            });

            document
                .querySelector('#btn-church')
                .addEventListener('click', () => {
                    map.flyTo({
                        center: [-118.146332, 34.063521],
                        zoom: 17
                    });
                });

            document.querySelector('#btn-run').addEventListener('click', () => {
                map.flyTo({
                    center: [-118.146125, 34.066507],
                    zoom: 17
                });
            });

            document
                .querySelector('#btn-school')
                .addEventListener('click', () => {
                    map.flyTo({
                        center: [-118.151082, 34.070773],
                        zoom: 17
                    });
                });

            document
                .querySelector('#btn-ruler-on')
                .addEventListener('click', () => {
                    ruler = true;
                    let outputDiv = document.getElementById('output');
                    outputDiv.innerHTML = 'Ruler On';
                });

            document
                .querySelector('#btn-ruler-off')
                .addEventListener('click', () => {
                    ruler = false;
                    let outputDiv = document.getElementById('output');
                    outputDiv.innerHTML = 'Ruler Off';
                });

            document
                .querySelector('#btn-move-drone')
                .addEventListener('click', () => {
                    // move drone object
                    numOfPoints = linestring.geometry.coordinates.length;
                    for (let i = 0; i < numOfPoints; i++) {
                        setTimeout(() => {
                            moveDrone(i);
                        }, 2000 * i);
                    }
                });

            document
                .querySelector('#btn-reset-drone')
                .addEventListener('click', () => {
                    drone.setCoords([-118.148512, 34.065868]);
                });
            // The following values can be changed to control rotation speed:

            // At low zooms, complete a revolution every two minutes.
            const secondsPerRevolution = 120;
            // Above zoom level 5, do not rotate.
            const maxSpinZoom = 5;
            // Rotate at intermediate speeds between zoom levels 3 and 5.
            const slowSpinZoom = 3;

            let userInteracting = false;
            let spinEnabled = true;

            function spinGlobe() {
                const zoom = map.getZoom();
                if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
                    let distancePerSecond = 360 / secondsPerRevolution;
                    if (zoom > slowSpinZoom) {
                        // Slow spinning at higher zooms
                        const zoomDif =
                            (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
                        distancePerSecond *= zoomDif;
                    }
                    const center = map.getCenter();
                    center.lng -= distancePerSecond;
                    // Smoothly animate the map over one second.
                    // When this animation is complete, it calls a 'moveend' event.
                    map.easeTo({ center, duration: 1000, easing: (n) => n });
                }
            }
			
			map.on('load', () => {
			  map.addLayer(boxLayer);
			});

            // Pause spinning on interaction
            map.on('mousedown', () => {
                userInteracting = true;
            });

            // Restart spinning the globe when interaction is complete
            map.on('mouseup', () => {
                userInteracting = false;
                spinGlobe();
            });

            // These events account for cases where the mouse has moved
            // off the map, so 'mouseup' will not be fired.
            map.on('dragend', () => {
                userInteracting = false;
                spinGlobe();
            });
            map.on('pitchend', () => {
                userInteracting = false;
                spinGlobe();
            });
            map.on('rotateend', () => {
                userInteracting = false;
                spinGlobe();
            });

            // When animation is complete, start spinning if there is no ongoing interaction
            map.on('moveend', () => {
                spinGlobe();
            });

            document
                .getElementById('btn-spin')
                .addEventListener('click', (e) => {
                    spinEnabled = !spinEnabled;
                    if (spinEnabled) {
                        spinGlobe();
                        e.target.innerHTML = 'Pause rotation';
                    } else {
                        map.stop(); // Immediately end ongoing animation
                        e.target.innerHTML = 'Start rotation';
                    }
                });

            spinGlobe();