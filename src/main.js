import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import katex from "katex";
import "katex/dist/katex.min.css";
import html2canvas from "html2canvas";


window.THREE = THREE;


class FigureVisualizer {
    static instance=null;
    constructor() {
        if (FigureVisualizer.instance) return FigureVisualizer.instance;
        if (this.sidebar = document.getElementById("app-sidebar"), this.container = document.getElementById("app-three"), 
        !this.sidebar || !this.container) throw new Error("не загрузились DOM els");
        this.scene = new THREE.Scene, this.ambientLight = new THREE.AmbientLight("white", .5), 
        this.scene.add(this.ambientLight), this.directionalLight = new THREE.DirectionalLight("white", 1), 
        this.directionalLight.position.set(5, 5, 5), this.scene.add(this.directionalLight), 
        this.camera = new THREE.PerspectiveCamera(75, (window.innerWidth - this.sidebar.offsetWidth) / window.innerHeight, .1, 100), 
        this.camera.position.z = 5, this.renderer = new THREE.WebGLRenderer, this.renderer.setSize(window.innerWidth - this.sidebar.offsetWidth, window.innerHeight), 
        this.renderer.setClearColor("#f2f2f2"), this.container.appendChild(this.renderer.domElement), 
        this.canvasSizes = this.renderer.domElement.getBoundingClientRect(), this.controls = new OrbitControls(this.camera, this.renderer.domElement), 
        this.controls.enableRotate = !0, this.controls.enableZoom = !0, this.controls.enableDamping = !1, 
        this.controls.minDistance = 2, this.controls.maxDistance = 10, this.controls.enablePan = !1, 
        this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE, this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE, 
        this._rotateSpeedSlow = .85, this._rotateSpeedFast = 2, this.controls.rotateSpeed = this._rotateSpeedSlow, 
        this._activeRotateButtons = new Set;
        const domEl = this.renderer.domElement;
        if (domEl.addEventListener("contextmenu", e => e.preventDefault()), domEl.addEventListener("pointerdown", e => this._onPointerDownRotate(e)), 
        domEl.addEventListener("pointerup", e => this._onPointerUpRotate(e)), domEl.addEventListener("pointercancel", e => this._onPointerUpRotate(e)), 
        domEl.addEventListener("pointerleave", e => this._onPointerUpRotate(e)), this._latexEdgeRegex = /\b([A-Z](?:_\d+)?)([A-Z](?:_\d+)?)\b/g, 
        this._latexAbsEdgeRegex = /\|\s*([A-Z](?:_\d+)?)([A-Z](?:_\d+)?)\s*\|/g, this._latexPointRegex = /\b([A-Z](?:_\d+)?)\b/g, 
        this.currentFigure = null, this.figureGeometry = null, this.edgesGeometry = null, 
        this.figureMesh = null, this.grid = null, this.originMaterial = new THREE.LineBasicMaterial({
            color: "#000000",
            linewidth: 5
        }), this.figures = {
            cube: {
                name: "Куб",
                params: [ {
                    name: "Длина ребра",
                    key: "edge",
                    default: 2
                } ],
                create: params => new THREE.BoxGeometry(params.edge, params.edge, params.edge)
            },
            parallelepiped: {
                name: "Параллелепипед",
                params: [ {
                    name: "Длина AB",
                    key: "AB",
                    default: 2
                }, {
                    name: "Длина AD",
                    key: "AD",
                    default: 2
                }, {
                    name: "Высота AA_1",
                    key: "AA1",
                    default: 2
                } ],
                create: params => new THREE.BoxGeometry(params.AB, params.AA1, params.AD)
            },
            prism: {
                name: "Призма",
                params: [ {
                    name: "Количество сторон основания",
                    key: "sides",
                    default: 3,
                    type: "integer",
                    min: 3
                }, {
                    name: "Тип",
                    key: "type",
                    default: "regular",
                    type: "select",
                    options: [ "regular", "irregular" ]
                }, {
                    name: "Ориентация",
                    key: "orientation",
                    default: "right",
                    type: "select",
                    options: [ "right", "oblique" ]
                }, {
                    name: "Длина ребра основания",
                    key: "baseEdge",
                    default: 2,
                    condition: params => "regular" === params.type
                }, {
                    name: "Высота",
                    key: "height",
                    default: 2
                }, {
                    name: "Длина бокового ребра",
                    key: "lateralEdge",
                    default: 2
                } ],
                create: params => {
                    if ("regular" === params.type) {
                        const r = params.baseEdge / (2 * Math.sin(Math.PI / params.sides)), base = Array.from({
                            length: params.sides
                        }, (_, i) => {
                            const angle = i / params.sides * Math.PI * 2;
                            return {
                                x: r * Math.cos(angle),
                                z: r * Math.sin(angle)
                            };
                        }), bottomVertices = base.map(p => new THREE.Vector3(p.x, 0, p.z));
                        let s = 0;
                        if ("oblique" === params.orientation) {
                            const l = Math.max(params.lateralEdge || params.height, params.height), h = params.height;
                            s = Math.sqrt(Math.max(0, l * l - h * h));
                        }
                        const topVertices = base.map(p => new THREE.Vector3(p.x + s, params.height, p.z)), geometry = new THREE.BufferGeometry, positions = new Float32Array([ ...bottomVertices, ...topVertices ].flatMap(v => [ v.x, v.y, v.z ]));
                        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                        const indices = [];
                        for (let i = 1; i < params.sides - 1; i++) indices.push(0, i, i + 1);
                        for (let i = 1; i < params.sides - 1; i++) indices.push(params.sides, params.sides + i + 1, params.sides + i);
                        for (let i = 0; i < params.sides; i++) {
                            const next = (i + 1) % params.sides;
                            indices.push(i, next, params.sides + i), indices.push(next, params.sides + next, params.sides + i);
                        }
                        return geometry.setIndex(indices), geometry.computeVertexNormals(), geometry;
                    }
                    {
                        let sideLengths = [];
                        for (let i = 0; i < params.sides; i++) {
                            const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % params.sides);
                            sideLengths.push(Math.max(.01, params[edgeKey] || 2));
                        }
                        if (!this.canFormPolygon(sideLengths)) {
                            const empty = new THREE.BufferGeometry;
                            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
                            empty;
                        }
                        const base = this.buildPolygonVerticesFromSideLengths(sideLengths);
                        if (!base || base.length < params.sides) {
                            const empty = new THREE.BufferGeometry;
                            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
                            empty;
                        }
                        let shiftX = 0;
                        if ("oblique" === params.orientation) {
                            const l = Math.max(params.lateralEdge || params.height, params.height), h = params.height;
                            shiftX = Math.sqrt(Math.max(0, l * l - h * h));
                        }
                        const centerShift = .5 * shiftX, bottomVertices = base.map(p => new THREE.Vector3(p.x - centerShift, 0, p.z)), topVertices = base.map(p => new THREE.Vector3(p.x + shiftX - centerShift, params.height, p.z)), geometry = new THREE.BufferGeometry, positions = new Float32Array([ ...bottomVertices, ...topVertices ].flatMap(v => [ v.x, v.y, v.z ]));
                        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                        const indices = [];
                        for (let i = 1; i < params.sides - 1; i++) indices.push(0, i, i + 1);
                        for (let i = 1; i < params.sides - 1; i++) indices.push(params.sides, params.sides + i + 1, params.sides + i);
                        for (let i = 0; i < params.sides; i++) {
                            const next = (i + 1) % params.sides;
                            indices.push(i, next, params.sides + i), indices.push(next, params.sides + next, params.sides + i);
                        }
                        return geometry.setIndex(indices), geometry.computeVertexNormals(), geometry;
                    }
                }
            },
            pyramid: {
                name: "Пирамида",
                params: [ {
                    name: "Количество сторон основания",
                    key: "sides",
                    default: 4,
                    type: "integer",
                    min: 3
                }, {
                    name: "Тип",
                    key: "type",
                    default: "regular",
                    type: "select",
                    options: [ "regular", "irregular" ]
                }, {
                    name: "Длина ребра основания",
                    key: "baseEdge",
                    default: 2,
                    condition: params => "regular" === params.type
                }, {
                    name: "Высота",
                    key: "height",
                    default: 2
                }, {
                    name: "Длина бокового ребра",
                    key: "lateralEdge",
                    default: 2,
                    condition: params => "regular" === params.type
                } ],
                create: params => {
                    if ("regular" === params.type) {
                        const radius = params.baseEdge / (2 * Math.sin(Math.PI / params.sides));
                        let height = params.height;
                        if ("number" == typeof params.lateralEdge) {
                            const l = Math.max(0, params.lateralEdge), h2 = Math.max(0, l * l - radius * radius);
                            height = Math.sqrt(h2);
                        }
                        return new THREE.ConeGeometry(radius, height, params.sides);
                    }
                    {
                        let sideLengths = [];
                        for (let i = 0; i < params.sides; i++) {
                            const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % params.sides);
                            sideLengths.push(Math.max(.01, params[edgeKey] || 2));
                        }
                        if (!this.canFormPolygon(sideLengths)) {
                            const empty = new THREE.BufferGeometry;
                            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
                            empty;
                        }
                        const baseVertices = this.buildPolygonVerticesFromSideLengths(sideLengths).map(p => new THREE.Vector3(p.x, 0, p.z)), lateralEdges = [];
                        for (let i = 0; i < params.sides; i++) {
                            const apexLabel = this.getVertexLabel(params.sides), edgeKey = this.getVertexLabel(i) + apexLabel;
                            lateralEdges.push(Math.max(.01, params[edgeKey] || params.height));
                        }
                        if (!this.isIrregularPyramidFeasible(sideLengths, lateralEdges).ok) {
                            const empty = new THREE.BufferGeometry;
                            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
                            empty;
                        }
                        const solved = this.solveApexFromEdges(baseVertices, lateralEdges, !0);
                        if (!solved.ok) {
                            const empty = new THREE.BufferGeometry;
                            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
                            empty;
                        }
                        const apex = solved.apex;
                        this.lastApexXZ = {
                            x: apex.x,
                            z: apex.z
                        };
                        const geometry = new THREE.BufferGeometry, positions = new Float32Array([ ...baseVertices, apex ].flatMap(v => [ v.x, v.y, v.z ]));
                        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                        const indices = [];
                        for (let i = 1; i < params.sides - 1; i++) indices.push(0, i, i + 1);
                        for (let i = 0; i < params.sides; i++) {
                            const next = (i + 1) % params.sides;
                            indices.push(i, next, params.sides);
                        }
                        return geometry.setIndex(indices), geometry.computeVertexNormals(), geometry;
                    }
                }
            },
            tetrahedron: {
                name: "Тетраэдр",
                params: [ {
                    name: "Тип",
                    key: "type",
                    default: "regular",
                    type: "select",
                    options: [ "regular", "irregular" ]
                }, {
                    name: "Длина ребра",
                    key: "edge",
                    default: 2,
                    condition: params => "regular" === params.type
                }, {
                    name: "Длина AB",
                    key: "AB",
                    default: 2,
                    condition: params => "irregular" === params.type
                }, {
                    name: "Длина AC",
                    key: "AC",
                    default: 2,
                    condition: params => "irregular" === params.type
                }, {
                    name: "Длина AD",
                    key: "AD",
                    default: 2,
                    condition: params => "irregular" === params.type
                }, {
                    name: "Длина BC",
                    key: "BC",
                    default: 2,
                    condition: params => "irregular" === params.type
                }, {
                    name: "Длина BD",
                    key: "BD",
                    default: 2,
                    condition: params => "irregular" === params.type
                }, {
                    name: "Длина CD",
                    key: "CD",
                    default: 2,
                    condition: params => "irregular" === params.type
                } ],
                create: params => {
                    if ("regular" === params.type) {
                        const edge = params.edge;
                        return this.createTetrahedron({
                            AB: edge,
                            AC: edge,
                            AD: edge,
                            BC: edge,
                            BD: edge,
                            CD: edge
                        });
                    }
                    return this.createTetrahedron(params);
                }
            },
            cylinder: {
                name: "Цилиндр",
                params: [ {
                    name: "Радиус",
                    key: "radius",
                    default: 1
                }, {
                    name: "Высота",
                    key: "height",
                    default: 2
                } ],
                create: params => new THREE.CylinderGeometry(params.radius, params.radius, params.height, 32)
            },
            cone: {
                name: "Конус",
                params: [ {
                    name: "Радиус",
                    key: "radius",
                    default: 1
                }, {
                    name: "Высота",
                    key: "height",
                    default: 2
                } ],
                create: params => new THREE.ConeGeometry(params.radius, params.height, 32)
            },
            sphere: {
                name: "Сфера",
                params: [ {
                    name: "Радиус",
                    key: "radius",
                    default: 1
                } ],
                create: params => new THREE.SphereGeometry(params.radius, 32, 32)
            }
        }, this.smoothFigures = new Set([ "cylinder", "cone", "sphere" ]), this.vertices = [], 
        this.vertexLabels = [], this.labelSprites = [], this.figureParams = {}, this.sections = [], 
        this.sectionDefinitions = [], this.sectionLabelSprites = [], this.previewMesh = null, 
        this.previewEdges = null, this.currentPoints = [], this.pointMarkers = [], this.namedPoints = {}, 
        this.namedPointLabels = {}, this.namedPointMarkers = {}, this.instructionOverlays = [], 
        this.figureOverlays = [], this.variables = {}, this._instrDebounce = null, this._paramsDebounce = null, 
        this._isParsingInstructions = !1, this._lastInstructionsText = "", this._labelTextureCache = {}, 
        this.namedVectors = {}, this.namedLines = {}, this.namedRays = {}, this.namedSegments = {}, 
        this.namedPlanes = {}, this.namedSections = {}, this.namedCircles = {}, this._initialFigureParams = {}, 
        this._userModifiedParams = !1, this.centerLabelIndex = 0, this.undoStack = [], this.redoStack = [], 
        this.sectionPointIndex = 0, this.labelBuildEpoch = 0, this.vertexLabelEpoch = 0, 
        this.currentStartIndex = 0, this.raycaster = new THREE.Raycaster, this.raycaster.params.Line.threshold = .1, 
        this.mouse = new THREE.Vector2, this.activeInput = null, this.isRemoving = !1, this.sectionPanel = document.getElementById("section-controls"), 
        !this.sectionPanel) throw new Error("Required DOM element missing.");
        const buttonCheck = document.getElementById("confirm-section"), buttonCancel = document.getElementById("cancel-section"), buttonUndo = document.getElementById("undo-action"), buttonRedo = document.getElementById("redo-action");
        buttonCheck && (buttonCheck.addEventListener("click", () => this.confirmSection()), 
        this.buttonCheck = buttonCheck, this.buttonCheck.disabled = !0), buttonCancel && buttonCancel.addEventListener("click", () => this.cancelSection()), 
        buttonUndo && buttonUndo.addEventListener("click", () => this.undoAction()), buttonRedo && buttonRedo.addEventListener("click", () => this.redoAction()), 
        this.initEventListeners(), this.createSidebarUI(), this.initInstructionUI(), this.currentFigureType = null, 
        this.gridCellSize = 1, this.gridMaxCells = 500, this.addGrid(), FigureVisualizer.instance = this, 
        this.animate();
    }
    _updateGridForBBox(bbox) {
        if (!bbox) return;
        const sizeX = Math.max(0, bbox.max.x - bbox.min.x), sizeZ = Math.max(0, bbox.max.z - bbox.min.z), desiredHalf = .5 * Math.max(sizeX, sizeZ) + 2 * this.gridCellSize, cellsPerHalf = Math.ceil(desiredHalf / this.gridCellSize), clampedCells = Math.min(this.gridMaxCells, Math.max(10, cellsPerHalf)), fullSize = 2 * clampedCells * this.gridCellSize, divisions = Math.max(10, 2 * clampedCells);
        (!this.grid || Math.abs((this._gridSize || 0) - fullSize) > 1e-6 || (this._gridDivisions || 0) !== divisions) && this.addGrid(fullSize, divisions);
    }
    _updateCameraForBBox(bbox) {
        if (!bbox) return;
        const dx = bbox.max.x - bbox.min.x, dy = bbox.max.y - bbox.min.y, dz = bbox.max.z - bbox.min.z, radius = Math.max(.5, .5 * Math.max(dx, dz)), height = Math.max(.5, dy), minDist = Math.max(1 * this.gridCellSize, Math.min(2 * this.gridCellSize, Math.min(radius, height))), maxDist = Math.max(10 * this.gridCellSize, radius + 4 * height);
        this.controls.minDistance = Math.max(this.controls.minDistance, minDist), this.controls.maxDistance = Math.max(this.controls.maxDistance, maxDist);
        const maxExtent = Math.max(Math.abs(bbox.max.x), Math.abs(bbox.max.y), Math.abs(bbox.max.z), Math.abs(bbox.min.x), Math.abs(bbox.min.y), Math.abs(bbox.min.z)), desiredFar = Math.max(100, 6 * maxExtent);
        this.camera.far < desiredFar && (this.camera.far = desiredFar, this.camera.updateProjectionMatrix());
    }
    _centerGeometryOnGrid(geometry) {
        if (!geometry || !geometry.boundingBox) return;
        const bbox = geometry.boundingBox, minY = bbox.min.y, centerX = (bbox.max.x + bbox.min.x) / 2, centerZ = (bbox.max.z + bbox.min.z) / 2;
        this._geometryTranslation = new THREE.Vector3(-centerX, -minY, -centerZ), geometry.translate(-centerX, -minY, -centerZ);
    }
    _validateGeometry(geometry) {
        return geometry && geometry.getAttribute && geometry.getAttribute("position") && geometry.getAttribute("position").count > 0;
    }
    _validateAndClampParam(key, min = .01) {
        const el = document.getElementById(`param-${key}`);
        if (el) {
            const v = Math.max(min, parseFloat(el.value) || this.figureParams[key]);
            v !== this.figureParams[key] && (this.figureParams[key] = v, el.value = String(v));
        }
    }
    _updateOrCreateNamedPoint(name, position, color = 16737792) {
        this.namedPointMarkers[name] ? (this.namedPointMarkers[name].position.copy(position), 
        this.namedPoints[name] = position.clone(), this.namedPointLabels[name] && this.namedPointLabels[name].position.copy(position)) : this.namedPoints[name] || this.addNamedPointMarker(name, position, color);
    }
    _initSmoothFigureOverlays(figureType, bbox) {
        if (bbox) if (this.namedCircles = {}, this.clearFigureOverlays(), "cylinder" === figureType) {
            const r = (bbox.max.x - bbox.min.x) / 2, h = bbox.max.y - bbox.min.y, centerBottom = new THREE.Vector3(0, 0, 0), centerTop = new THREE.Vector3(0, h, 0);
            this.createFigureOverlayCircle(centerTop, new THREE.Vector3(0, 1, 0), r, "#000000"), 
            this.createFigureOverlayCircle(centerBottom, new THREE.Vector3(0, 1, 0), r, "#000000"), 
            this.namedCircles = {
                a: {
                    center: centerBottom.clone(),
                    normal: new THREE.Vector3(0, 1, 0),
                    radius: r
                },
                b: {
                    center: centerTop.clone(),
                    normal: new THREE.Vector3(0, 1, 0),
                    radius: r
                }
            }, this._updateOrCreateNamedPoint("O", centerBottom), this._updateOrCreateNamedPoint("O_1", centerTop);
        } else if ("cone" === figureType) {
            const r = (bbox.max.x - bbox.min.x) / 2, centerBase = (bbox.max.y, bbox.min.y, new THREE.Vector3(0, 0, 0));
            this.createFigureOverlayCircle(centerBase, new THREE.Vector3(0, 1, 0), r, "#000000"), 
            this.namedCircles = {
                a: {
                    center: centerBase.clone(),
                    normal: new THREE.Vector3(0, 1, 0),
                    radius: r
                }
            }, this._updateOrCreateNamedPoint("O", centerBase);
        } else if ("sphere" === figureType) {
            const r = (bbox.max.x - bbox.min.x) / 2, center = new THREE.Vector3(0, r, 0);
            this.createFigureOverlayCircle(center, new THREE.Vector3(0, 1, 0), r, "#000000"), 
            this.createFigureOverlayCircle(center, new THREE.Vector3(1, 0, 0), r, "#000000"), 
            this.namedCircles = {
                a: {
                    center: center.clone(),
                    normal: new THREE.Vector3(0, 1, 0),
                    radius: r
                },
                b: {
                    center: center.clone(),
                    normal: new THREE.Vector3(1, 0, 0),
                    radius: r
                }
            }, this._updateOrCreateNamedPoint("O", center);
        }
    }
    _removeFigureFromScene() {
        this.currentFigure && (this.scene.remove(this.currentFigure), this.currentFigure.geometry.dispose(), 
        this.currentFigure.material.dispose(), this.currentFigure = null), this.figureMesh && (this.scene.remove(this.figureMesh), 
        this.figureMesh.material.dispose(), this.figureMesh = null);
    }
    _createAndAddFigureToScene(figureType) {
        if (this.edgesGeometry = new THREE.EdgesGeometry(this.figureGeometry), this.smoothFigures.has(figureType)) {
            const material = new THREE.MeshStandardMaterial({
                color: "#000000",
                transparent: !0,
                opacity: .4,
                metalness: 0,
                roughness: 1
            });
            this.figureMesh = new THREE.Mesh(this.figureGeometry, material), this.scene.add(this.figureMesh), 
            this._initSmoothFigureOverlays(figureType, this.figureGeometry.boundingBox);
        } else this.currentFigure = new THREE.LineSegments(this.edgesGeometry, this.originMaterial), 
        this.scene.add(this.currentFigure);
    }
    _getLabelDirection(position) {
        const pos = position.clone();
        if (pos.length() > .1) return pos.normalize();
        const camPos = this.camera.position.clone(), camToPoint = pos.clone().sub(camPos);
        return camToPoint.length() > .1 ? camToPoint.clone().normalize().multiplyScalar(-1) : new THREE.Vector3(0, 1, 0);
    }
    _disposeSprite(sprite) {
        if (sprite) try {
            sprite.material && sprite.material.map && sprite.material.map.dispose(), sprite.material && sprite.material.dispose(), 
            sprite.geometry && sprite.geometry.dispose();
        } catch (_) {}
    }
    _disposeMesh(mesh) {
        if (mesh) try {
            mesh.geometry && mesh.geometry.dispose(), mesh.material && mesh.material.dispose();
        } catch (_) {}
    }
    _clearPreviewSection() {
        this.previewMesh && (this.scene.remove(this.previewMesh), this._disposeMesh(this.previewMesh), 
        this.previewMesh = null), this.previewEdges && (this.scene.remove(this.previewEdges), 
        this._disposeMesh(this.previewEdges), this.previewEdges = null);
    }
    _nextCenterLabelName() {
        const idx = this.centerLabelIndex++;
        return 0 === idx ? "O" : `O_${idx}`;
    }
    _allocCenterLabel() {
        const isTaken = name => !(!this.namedPoints || !this.namedPoints[name]) || !(!this.namedPointMarkers || !this.namedPointMarkers[name]) || !!Array.isArray(this.vertexLabels) && this.vertexLabels.indexOf(name) >= 0;
        let idx = 0;
        for (;;) {
            const candidate = 0 === idx ? "O" : `O_${idx}`;
            if (!isTaken(candidate)) return candidate;
            idx++;
        }
    }
    _parseEdgeSpec(spec) {
        const t = String(spec || "").trim(), cm = t.match(/^([A-Za-zА-Яа-я](?:_\d+)?)[\s,]+([A-Za-zА-Яа-я](?:_\d+)?)$/);
        if (cm) return [ cm[1], cm[2] ];
        const mm = t.replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/);
        return mm ? [ mm[1], mm[2] ] : null;
    }
    _parseEdgeOrVariable(trimmed) {
        const mm = trimmed.match(/^([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)$/);
        if (mm) {
            const A = this.getPointByName(mm[1]), B = this.getPointByName(mm[2]);
            if (A && B) return {
                A: A,
                B: B
            };
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
            const edgeRef = this.variables && this.variables._edges && this.variables._edges[trimmed];
            if (edgeRef) {
                const edgeMm = edgeRef.match(/^([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)$/);
                if (edgeMm) {
                    const A = this.getPointByName(edgeMm[1]), B = this.getPointByName(edgeMm[2]);
                    if (A && B) return {
                        A: A,
                        B: B
                    };
                }
            }
            if (this.namedSegments[trimmed]) {
                const seg = this.namedSegments[trimmed];
                if (seg.a && seg.b) return {
                    A: seg.a,
                    B: seg.b
                };
            }
            if (this.namedRays[trimmed]) {
                const ray = this.namedRays[trimmed];
                if (ray.origin && ray.dir) {
                    const B = ray.origin.clone().add(ray.dir);
                    return {
                        A: ray.origin,
                        B: B
                    };
                }
            }
            if (this.namedLines[trimmed]) {
                const line = this.namedLines[trimmed];
                if (line.point && line.dir) {
                    const B = line.point.clone().add(line.dir);
                    return {
                        A: line.point,
                        B: B
                    };
                }
            }
        }
        return null;
    }
    _onPointerDownRotate(e) {
        0 !== e.button && 2 !== e.button || (this._activeRotateButtons.add(e.button), this._activeRotateButtons.has(2) ? this.controls.rotateSpeed = this._rotateSpeedFast : this.controls.rotateSpeed = this._rotateSpeedSlow);
    }
    _onPointerUpRotate(e) {
        0 !== e.button && 2 !== e.button || (this._activeRotateButtons.delete(e.button), 
        this._activeRotateButtons.has(2) ? this.controls.rotateSpeed = this._rotateSpeedFast : this.controls.rotateSpeed = this._rotateSpeedSlow);
    }
    _renderLabelWithEdgeKaTeX(container, fullText) {
        try {
            const match = String(fullText).match(/^(.*?)([A-Z](?:_\d+)?[A-Z](?:_\d+)?)(?:\s*)$/);
            if (!match) return void (container.textContent = `${fullText}: `);
            const prefix = match[1], edge = match[2];
            container.innerHTML = "";
            const spanPrefix = document.createElement("span");
            spanPrefix.textContent = prefix.trimEnd() + (prefix ? " " : ""), container.appendChild(spanPrefix);
            const spanEdge = document.createElement("span");
            try {
                katex.render(edge, spanEdge, {
                    throwOnError: !1,
                    strict: "ignore",
                    output: "mathml"
                });
            } catch (_) {
                spanEdge.textContent = edge;
            }
            container.appendChild(spanEdge), container.appendChild(document.createTextNode(": "));
        } catch {
            container.textContent = fullText + ": ";
        }
    }
    _renderInstructionTextWithKaTeX(container, text) {
        const parts = [];
        let last = 0;
        const input = String(text);
        input.replace(this._latexAbsEdgeRegex, (m, a, b, idx) => (idx > last && parts.push({
            t: input.slice(last, idx)
        }), parts.push({
            k: `|${a}${b}|`,
            abs: !0
        }), last = idx + m.length, m));
        const afterAbs = input.slice(last);
        last = 0;
        const parts2 = [];
        afterAbs.replace(this._latexEdgeRegex, (m, a, b, idx) => (idx > last && parts2.push({
            t: afterAbs.slice(last, idx)
        }), parts2.push({
            k: `${a}${b}`
        }), last = idx + m.length, m)), last < afterAbs.length && parts2.push({
            t: afterAbs.slice(last)
        });
        const enriched = [], splitByPoints = txt => {
            const s = String(txt);
            let i = 0;
            const re = /[A-Z](?:_\d+)?/g;
            let m3;
            for (;null !== (m3 = re.exec(s)); ) {
                const idx = m3.index;
                idx > i && enriched.push({
                    t: s.slice(i, idx)
                }), enriched.push({
                    k: m3[0]
                }), i = idx + m3[0].length;
            }
            i < s.length && enriched.push({
                t: s.slice(i)
            });
        };
        for (const p of parts) enriched.push(p);
        for (const p of parts2) void 0 !== p.t ? splitByPoints(p.t) : enriched.push(p);
        container.innerHTML = "";
        for (const p of enriched) if (void 0 !== p.t) container.appendChild(document.createTextNode(p.t)); else if (p.k) {
            const span = document.createElement("span");
            try {
                const toRender = p.abs ? `\\left|${p.k.slice(1, -1)}\\right|` : p.k;
                katex.render(toRender, span, {
                    throwOnError: !1,
                    strict: "ignore",
                    output: "mathml"
                });
            } catch {
                span.textContent = p.k;
            }
            container.appendChild(span);
        }
    }
    _renderInstructionValueWithKaTeX(container, text) {
        try {
            const s = String(text).trim();
            if (/^TeX:/.test(s)) {
                const tex = s.slice(4);
                katex.render(tex, container, {
                    throwOnError: !1,
                    strict: "ignore",
                    output: "mathml"
                });
            } else if (/^[-+]?\d+(?:[.,]\d+)?(?:°)?$/.test(s)) {
                const normalized = s.replace(",", ".");
                katex.render(normalized, container, {
                    throwOnError: !1,
                    output: "mathml"
                });
            } else this._latexAbsEdgeRegex.test(s) || this._latexEdgeRegex.test(s) ? this._renderInstructionTextWithKaTeX(container, s) : container.textContent = text;
        } catch {
            container.textContent = text;
        }
    }
    _evaluateExpression(expr) {
        try {
            if (null == expr) return null;
            const s = String(expr).trim();
            if (!s) return null;
            if (/^[-+]?[0-9]*\.?[0-9]+$/.test(s)) return Number(s);
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
                const v = this.variables && Object.prototype.hasOwnProperty.call(this.variables, s) ? this.variables[s] : null;
                return "number" == typeof v && Number.isFinite(v) ? v : null;
            }
            let replaced = s.replace(/([A-Za-z_][A-Za-z0-9_]*)/g, m => {
                if (Object.prototype.hasOwnProperty.call(this.variables || {}, m)) {
                    const vv = this.variables[m];
                    return "number" == typeof vv && Number.isFinite(vv) ? String(vv) : "NaN";
                }
                return m;
            });
            replaced = replaced.replace(/\bsqrt\(/g, "Math.sqrt("), replaced = replaced.replace(/\babs\(/g, "Math.abs("), 
            replaced = replaced.replace(/\bpi\b/gi, "Math.PI"), replaced = replaced.replace(/\bcos\(/g, "Math.cos("), 
            replaced = replaced.replace(/\bsin\(/g, "Math.sin("), replaced = replaced.replace(/\btan\(/g, "Math.tan(");
            const val = new Function(`return (${replaced});`)();
            return "number" == typeof val && Number.isFinite(val) ? val : null;
        } catch {
            return null;
        }
    }
    getVertexLabel(index) {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index % 26] + (Math.floor(index / 26) > 0 ? `_${Math.floor(index / 26)}` : "");
    }
    buildPolygonVerticesFromSideLengths(sideLengths) {
        const n = sideLengths.length, maxLen = Math.max(...sideLengths), clamp = (v, min, max) => Math.min(Math.max(v, min), max);
        let low = maxLen / 2 + .001, high = 1e6;
        const target = 2 * Math.PI, sumAngles = R => sideLengths.reduce((s, c) => s + 2 * Math.asin(clamp(c / (2 * R), 0, .999999)), 0);
        for (let i = 0; i < 80; i++) {
            const mid = (low + high) / 2;
            sumAngles(mid) > target ? low = mid : high = mid;
        }
        const R = (low + high) / 2, angles = sideLengths.map(c => 2 * Math.asin(clamp(c / (2 * R), 0, .999999))), scale = target / angles.reduce((a, b) => a + b, 0);
        let current = 0;
        const vertices = [];
        for (let i = 0; i < n; i++) vertices.push({
            x: R * Math.cos(current),
            z: R * Math.sin(current)
        }), current += angles[i] * scale;
        return vertices;
    }
    canFormPolygon(sideLengths) {
        const total = sideLengths.reduce((a, b) => a + b, 0), maxLen = Math.max(...sideLengths);
        return maxLen < total - maxLen;
    }
    computeApexLeastSquares(baseVertices, lateralEdges) {
        const n = baseVertices.length;
        if (n < 3 || lateralEdges.length !== n) return {
            ok: !1
        };
        const v0 = baseVertices[0];
        let Saa = 0, Sbb = 0, Sab = 0, Sac = 0, Sbc = 0;
        const c0 = v0.x * v0.x + v0.z * v0.z - lateralEdges[0] * lateralEdges[0];
        for (let i = 1; i < n; i++) {
            const vi = baseVertices[i], ai = 2 * (vi.x - v0.x), bi = 2 * (vi.z - v0.z), ci = vi.x * vi.x + vi.z * vi.z - lateralEdges[i] * lateralEdges[i] - c0;
            Saa += ai * ai, Sbb += bi * bi, Sab += ai * bi, Sac += ai * ci, Sbc += bi * ci;
        }
        const det = Saa * Sbb - Sab * Sab;
        if (Math.abs(det) < 1e-9) return {
            ok: !1
        };
        const x = (Sbb * Sac - Sab * Sbc) / det, z = (Saa * Sbc - Sab * Sac) / det, y2s = [];
        let minY2 = 1 / 0, maxDev = 0, sumY2 = 0;
        for (let i = 0; i < n; i++) {
            const vi = baseVertices[i], d2 = (x - vi.x) * (x - vi.x) + (z - vi.z) * (z - vi.z), y2 = lateralEdges[i] * lateralEdges[i] - d2;
            y2s.push(y2), minY2 = Math.min(minY2, y2), sumY2 += y2;
        }
        const avgY2 = sumY2 / n;
        for (let i = 0; i < n; i++) maxDev = Math.max(maxDev, Math.abs(y2s[i] - avgY2));
        const L2scale = Math.max(1, lateralEdges.reduce((s, L) => s + L * L, 0) / n);
        return {
            ok: minY2 >= -1e-6 * L2scale && maxDev <= .001 * L2scale,
            x: x,
            z: z,
            y2: Math.max(0, avgY2),
            y2s: y2s
        };
    }
    _computeAngleSumForY(sideLengths, lateralEdges, y) {
        const n = sideLengths.length, d = new Array(n);
        for (let i = 0; i < n; i++) {
            const L = lateralEdges[i], v = L * L - y * y;
            if (v < -1e-8) return {
                ok: !1
            };
            if (d[i] = Math.sqrt(Math.max(0, v)), !(d[i] > 1e-9)) return {
                ok: !1
            };
        }
        let sum = 0;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n, a = d[i], b = d[j], s = sideLengths[i], denom = 2 * a * b;
            if (!(denom > 1e-9)) return {
                ok: !1
            };
            const cosv = (a * a + b * b - s * s) / denom;
            if (cosv < -1 - 1e-9 || cosv > 1 + 1e-9) return {
                ok: !1
            };
            const c = Math.max(-1, Math.min(1, cosv)), delta = Math.acos(c);
            if (!(delta > 0)) return {
                ok: !1
            };
            sum += delta;
        }
        return {
            ok: !0,
            sum: sum,
            d: d
        };
    }
    isIrregularPyramidFeasible(sideLengths, lateralEdges) {
        const n = sideLengths.length;
        if (n < 3 || lateralEdges.length !== n) return {
            ok: !1
        };
        const yMax = Math.max(0, Math.min(...lateralEdges) - 1e-6);
        if (!(yMax > 0)) return {
            ok: !1
        };
        const target = 2 * Math.PI;
        let best = {
            val: 1 / 0,
            y: 0,
            d: null
        };
        for (let k = 0; k <= 64; k++) {
            const y = yMax * k / 64, r = this._computeAngleSumForY(sideLengths, lateralEdges, y);
            if (!r.ok) continue;
            const dev = Math.abs(r.sum - target);
            dev < best.val && (best = {
                val: dev,
                y: y,
                d: r.d
            });
        }
        if (!Number.isFinite(best.val)) return {
            ok: !1
        };
        let left = Math.max(0, best.y - yMax / 10), right = Math.min(yMax, best.y + yMax / 10);
        for (let it = 0; it < 40; it++) {
            const m1 = left + (right - left) / 3, m2 = right - (right - left) / 3, r1 = this._computeAngleSumForY(sideLengths, lateralEdges, m1), r2 = this._computeAngleSumForY(sideLengths, lateralEdges, m2);
            (r1.ok ? Math.abs(r1.sum - target) : 1 / 0) < (r2.ok ? Math.abs(r2.sum - target) : 1 / 0) ? right = m2 : left = m1;
        }
        const mid = (left + right) / 2, rf = this._computeAngleSumForY(sideLengths, lateralEdges, mid);
        return rf.ok ? Math.abs(rf.sum - target) > .1 ? {
            ok: !1
        } : {
            ok: !0,
            y: mid,
            d: rf.d
        } : {
            ok: !1
        };
    }
    solveApexFromEdges(baseVertices, lateralEdges, strict) {
        const fit = this.computeApexLeastSquares(baseVertices, lateralEdges);
        if (strict) {
            if (!fit.ok) return {
                ok: !1
            };
            const y = Math.sqrt(fit.y2);
            return {
                ok: !0,
                apex: new THREE.Vector3(fit.x, y, fit.z),
                y: y
            };
        }
        const x = fit && Number.isFinite(fit.x) ? fit.x : 0, z = fit && Number.isFinite(fit.z) ? fit.z : 0, d = baseVertices.map(v => Math.hypot(x - v.x, z - v.z)), y2avg = Math.max(0, lateralEdges.reduce((s, L, i) => s + Math.max(0, L * L - d[i] * d[i]), 0) / lateralEdges.length), y = Math.sqrt(y2avg), adjusted = d.map(di => Math.sqrt(di * di + y2avg));
        return {
            ok: !0,
            apex: new THREE.Vector3(x, y, z),
            y: y,
            adjustedL: adjusted
        };
    }
    createTetrahedron(params) {
        const AB = params.AB, AC = params.AC, AD = params.AD, BC = params.BC, BD = params.BD, CD = params.CD, A = new THREE.Vector3(0, 0, 0), B = new THREE.Vector3(AB, 0, 0), x = (AB * AB + AC * AC - BC * BC) / (2 * AB), z = Math.sqrt(Math.max(0, AC * AC - x * x));
        if (!(z > 0)) {
            const empty = new THREE.BufferGeometry;
            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
            empty;
        }
        const C = new THREE.Vector3(x, 0, z), p = (AB * AB + AD * AD - BD * BD) / (2 * AB), qz = (AD * AD + AC * AC - CD * CD - 2 * p * x) / (2 * z), y2 = AD * AD - p * p - qz * qz;
        if (!(y2 >= 0)) {
            const empty = new THREE.BufferGeometry;
            return empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array([]), 3)), 
            empty;
        }
        const yD = Math.sqrt(y2), D = new THREE.Vector3(p, Math.abs(yD), qz), geometry = new THREE.BufferGeometry, positions = new Float32Array([ A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, D.x, D.y, D.z ]);
        return geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3)), 
        geometry.setIndex([ 0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3 ]), geometry.computeVertexNormals(), 
        geometry;
    }
    async confirmMessage(message) {
        return new Promise(resolve => {
            const overlay = document.getElementById("confirm-overlay"), messageEl = document.getElementById("confirm-message"), yesBtn = document.getElementById("confirm-yes"), noBtn = document.getElementById("confirm-no");
            if (!(overlay && messageEl && yesBtn && noBtn)) return void resolve(!1);
            messageEl.textContent = message, overlay.classList.remove("hidden"), overlay.classList.add("flex");
            const cleanup = () => {
                overlay.classList.add("hidden"), overlay.classList.remove("flex"), messageEl.textContent = "", 
                yesBtn.removeEventListener("click", onYes), noBtn.removeEventListener("click", onNo), 
                overlay.removeEventListener("click", onOverlayClick);
            }, onYes = () => {
                cleanup(), resolve(!0);
            }, onNo = () => {
                cleanup(), resolve(!1);
            }, onOverlayClick = e => {
                e.target === overlay && onNo();
            };
            yesBtn.addEventListener("click", onYes), noBtn.addEventListener("click", onNo), 
            overlay.addEventListener("click", onOverlayClick);
        });
    }
    initEventListeners() {
        window.addEventListener("click", event => this.onMouseClick(event));
    }
    initInstructionUI() {
        const textarea = document.getElementById("instruction-input"), kb = document.getElementById("symbol-keyboard"), results = document.getElementById("instruction-results"), helpBtn = (document.getElementById("answers-output"), 
        document.getElementById("help-instructions-btn"));
        if (kb && textarea && kb.addEventListener("click", e => {
            const target = e.target;
            if (target && "BUTTON" === target.tagName && target.hasAttribute("data-symbol")) {
                const sym = target.getAttribute("data-symbol") || target.textContent;
                this.insertSymbolAtCursor(textarea, sym), textarea.dispatchEvent(new Event("input"));
            }
        }), textarea && results) {
            const handler = () => {
                this._instrDebounce && clearTimeout(this._instrDebounce), this._instrDebounce = setTimeout(() => this.parseAndApplyInstructions(), 600);
            };
            textarea.addEventListener("input", handler);
        }
        helpBtn && helpBtn.addEventListener("click", () => this.showHelpModal());
    }
    insertSymbolAtCursor(textarea, symbol) {
        const start = textarea.selectionStart || 0, end = textarea.selectionEnd || 0, before = textarea.value.slice(0, start), after = textarea.value.slice(end);
        textarea.value = before + symbol + after;
        const pos = start + symbol.length;
        textarea.selectionStart = textarea.selectionEnd = pos, textarea.focus();
    }
    clearInstructionOverlays() {
        this.instructionOverlays.forEach(obj => {
            this.scene.remove(obj), this._disposeMesh(obj);
        }), this.instructionOverlays = [];
    }
    clearFigureOverlays() {
        this.figureOverlays.forEach(obj => {
            this.scene.remove(obj), this._disposeMesh(obj);
        }), this.figureOverlays = [];
    }
    createFigureOverlayPolyline(points, color = "#000000") {
        if (!points || points.length < 2) return null;
        const geometry = (new THREE.BufferGeometry).setFromPoints(points), line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2
        }));
        return this.scene.add(line), this.figureOverlays.push(line), line;
    }
    createFigureOverlayCircle(center, normal, radius, color = "#000000", segments = 180) {
        if (!(center && normal && radius > 0)) return null;
        const n = normal.clone().normalize(), arbitrary = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), e1 = (new THREE.Vector3).crossVectors(n, arbitrary).normalize(), e2 = (new THREE.Vector3).crossVectors(n, e1).normalize(), pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments * Math.PI * 2, p = center.clone().add(e1.clone().multiplyScalar(radius * Math.cos(t))).add(e2.clone().multiplyScalar(radius * Math.sin(t)));
            pts.push(p);
        }
        return this.createFigureOverlayPolyline(pts, color);
    }
    createOverlayInfiniteLine(point, direction, color = "#00aa00") {
        const dir = direction.clone().normalize(), a = point.clone().add(dir.clone().multiplyScalar(-1e3)), b = point.clone().add(dir.clone().multiplyScalar(1e3));
        return this.createOverlayLineSegment(a, b, color, !0);
    }
    createOverlayRay(origin, direction, color = "#00aa00") {
        const dir = direction.clone().normalize(), b = origin.clone().add(dir.clone().multiplyScalar(1e3));
        return this.createOverlayLineSegment(origin, b, color, !0);
    }
    createOverlayPolyline(points, color = "#006400") {
        if (!points || points.length < 2) return null;
        const geometry = (new THREE.BufferGeometry).setFromPoints(points), line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2
        }));
        return this.scene.add(line), this.instructionOverlays.push(line), line;
    }
    createOverlayCircle(center, normal, radius, color = 2003199, segments = 128) {
        if (!(center && normal && radius > 0)) return null;
        const n = normal.clone().normalize(), arbitrary = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), e1 = (new THREE.Vector3).crossVectors(n, arbitrary).normalize(), e2 = (new THREE.Vector3).crossVectors(n, e1).normalize(), pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments * Math.PI * 2, p = center.clone().add(e1.clone().multiplyScalar(radius * Math.cos(t))).add(e2.clone().multiplyScalar(radius * Math.sin(t)));
            pts.push(p);
        }
        return this.createOverlayPolyline(pts, color);
    }
    createOverlaySphere(center, radius, color = 2003199) {
        if (!(center && radius > 0)) return null;
        const geom = new THREE.SphereGeometry(radius, 24, 18), mat = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: !0,
            transparent: !0,
            opacity: .4
        }), mesh = new THREE.Mesh(geom, mat);
        return mesh.position.copy(center), this.scene.add(mesh), this.instructionOverlays.push(mesh), 
        mesh;
    }
    _estimateOverlayScale(fallback = .25) {
        let size = fallback;
        if (this.figureGeometry) {
            this.figureGeometry.boundingBox || this.figureGeometry.computeBoundingBox();
            const bb = this.figureGeometry.boundingBox;
            if (bb) {
                const dx = bb.max.x - bb.min.x, dy = bb.max.y - bb.min.y, dz = bb.max.z - bb.min.z, span = Math.max(dx, dy, dz);
                size = Math.max(.06 * span, fallback);
            }
        }
        return size;
    }
    createOverlayPlane(point, normal, size = 4, color = 2003199, opacity = .15) {
        const nRaw = normal.clone(), nLen = nRaw.length();
        if (!(nLen > 1e-9)) return null;
        const n = nRaw.clone().multiplyScalar(1 / nLen), arbitrary = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), e1 = (new THREE.Vector3).crossVectors(n, arbitrary).normalize(), e2 = (new THREE.Vector3).crossVectors(n, e1).normalize();
        let span = size, center = point.clone();
        if (this.figureGeometry) {
            this.figureGeometry.boundingBox || this.figureGeometry.computeBoundingBox();
            const bbox = this.figureGeometry.boundingBox;
            if (bbox) {
                const dx = bbox.max.x - bbox.min.x, dy = bbox.max.y - bbox.min.y, dz = bbox.max.z - bbox.min.z, figureSpan = Math.max(dx, dy, dz);
                span = Math.max(size || 0, 1.6 * figureSpan);
                const figCenter = new THREE.Vector3((bbox.max.x + bbox.min.x) / 2, (bbox.max.y + bbox.min.y) / 2, (bbox.max.z + bbox.min.z) / 2), t = n.dot(point.clone().sub(figCenter));
                center = figCenter.clone().add(n.clone().multiplyScalar(t));
            }
        }
        const half = span / 2, corners = [ center.clone().add(e1.clone().multiplyScalar(-half)).add(e2.clone().multiplyScalar(-half)), center.clone().add(e1.clone().multiplyScalar(half)).add(e2.clone().multiplyScalar(-half)), center.clone().add(e1.clone().multiplyScalar(half)).add(e2.clone().multiplyScalar(half)), center.clone().add(e1.clone().multiplyScalar(-half)).add(e2.clone().multiplyScalar(half)) ], geometry = new THREE.BufferGeometry, positions = new Float32Array([ corners[0].x, corners[0].y, corners[0].z, corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z, corners[0].x, corners[0].y, corners[0].z, corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z ]);
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: !0,
            opacity: opacity
        }), mesh = new THREE.Mesh(geometry, material);
        return this.scene.add(mesh), this.instructionOverlays.push(mesh), mesh;
    }
    createAngleArc(origin, dir1, dir2, radius = .5, color = 16737792, segments = 32) {
        if (!origin || !dir1 || !dir2) return null;
        const d1 = dir1.clone().normalize(), d2 = dir2.clone().normalize();
        if (!(d1.length() > 1e-9 && d2.length() > 1e-9)) return null;
        const target = Math.min(1, Math.max(-1, d1.dot(d2))) < 0 ? d2.clone().multiplyScalar(-1) : d2.clone(), dotT = Math.min(1, Math.max(-1, d1.dot(target))), angle = Math.acos(dotT);
        if (!(angle > 1e-9)) return null;
        const normal = (new THREE.Vector3).crossVectors(d1, target).normalize();
        if (!(normal.length() > 1e-9)) return null;
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments * angle, cos_t = Math.cos(t), sin_t = Math.sin(t), rotated = d1.clone().multiplyScalar(cos_t).add((new THREE.Vector3).crossVectors(normal, d1).multiplyScalar(sin_t)).add(normal.clone().multiplyScalar(normal.dot(d1) * (1 - cos_t)));
            pts.push(origin.clone().add(rotated.normalize().multiplyScalar(radius)));
        }
        return this.createOverlayPolyline(pts, color);
    }
    createRightAngleMark(origin, dirA, dirB, size = .25, color = "#8a2be2") {
        if (!origin || !dirA || !dirB) return null;
        const e1 = dirA.clone().normalize();
        let e2 = dirB.clone().normalize();
        if (e2 = e2.clone().sub(e1.clone().multiplyScalar(e2.dot(e1))), !(e1.length() > 1e-9 && e2.length() > 1e-9)) return null;
        e2.normalize();
        const p1 = origin.clone().add(e1.clone().multiplyScalar(size)), p2 = origin.clone().add(e2.clone().multiplyScalar(size)), p12 = origin.clone().add(e1.clone().multiplyScalar(size)).add(e2.clone().multiplyScalar(size));
        return this.createOverlayLineSegment(p1, p12, color, !1), this.createOverlayLineSegment(p2, p12, color, !1), 
        !0;
    }
    _normalizeName(raw) {
        const map = {
            "А": "A",
            "В": "B",
            "С": "C",
            "Е": "E",
            "Н": "H",
            "К": "K",
            "М": "M",
            "О": "O",
            "Р": "P",
            "Т": "T",
            "Х": "X",
            "а": "a",
            "в": "b",
            "с": "c",
            "е": "e",
            "н": "h",
            "к": "k",
            "м": "m",
            "о": "o",
            "р": "p",
            "т": "t",
            "х": "x"
        }, s = String(raw || "");
        let out = "";
        for (const ch of s) out += map[ch] || ch;
        return out;
    }
    getPointByName(name) {
        if (!name) return null;
        const norm = this._normalizeName(name);
        let idx = this.vertexLabels.indexOf(name);
        if (idx < 0 && (idx = this.vertexLabels.indexOf(norm)), idx >= 0 && this.vertices[idx]) return this.vertices[idx].clone();
        if (this.namedPoints[name]) return this.namedPoints[name].clone();
        if (this.namedPoints[norm]) return this.namedPoints[norm].clone();
        if (this.sections && Array.isArray(this.sections)) for (const section of this.sections) {
            if (!section || !Array.isArray(section.labels) || !Array.isArray(section.points)) continue;
            const secIdx = section.labels.indexOf(name);
            if (secIdx >= 0 && section.points[secIdx]) return section.points[secIdx].clone();
            const secIdxNorm = section.labels.indexOf(norm);
            if (secIdxNorm >= 0 && section.points[secIdxNorm]) return section.points[secIdxNorm].clone();
        }
        return null;
    }
    addNamedPointMarker(name, position, color = 16737792) {
        const geometry = new THREE.SphereGeometry(.045, 16, 16), material = new THREE.MeshBasicMaterial({
            color: color
        }), marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position), marker.userData = {
            name: name
        }, this.scene.add(marker), this.namedPoints[name] = position.clone();
        const isVertex = this.vertexLabels && this.vertexLabels.indexOf(name) >= 0;
        if (this.namedPointMarkers[name] = marker, this.instructionOverlays.push(marker), 
        !isVertex) {
            const epoch = this.instructionBuildEpoch || 0;
            this.createLabel(name).then(label => {
                if (!label) return;
                if ((this.instructionBuildEpoch || 0) !== epoch) return void this._disposeSprite(label);
                if (this.namedPointLabels[name]) {
                    const prev = this.namedPointLabels[name];
                    this.scene.remove(prev);
                    const idx = this.instructionOverlays.indexOf(prev);
                    idx >= 0 && this.instructionOverlays.splice(idx, 1), this._disposeSprite(prev);
                }
                const current = marker.position.clone(), direction = this._getLabelDirection(current);
                label.position.copy(current).add(direction.multiplyScalar(.35)), this.scene.add(label), 
                this.instructionOverlays.push(label), this.namedPointLabels[name] = label;
            }).catch(() => {});
        }
        return marker;
    }
    createOverlayLineSegment(a, b, color = "#00aa00", dashed = !1) {
        const geometry = (new THREE.BufferGeometry).setFromPoints([ a, b ]);
        let material;
        material = dashed ? new THREE.LineDashedMaterial({
            color: color,
            dashSize: .15,
            gapSize: .08
        }) : new THREE.LineBasicMaterial({
            color: color,
            linewidth: 2
        });
        const line = new THREE.Line(geometry, material);
        return dashed && line.computeLineDistances(), this.scene.add(line), this.instructionOverlays.push(line), 
        line;
    }
    formatDistanceValue(v, nameA = null, nameB = null) {
        if (!Number.isFinite(v)) return "";
        const prec = v < .001 ? 6 : v < 1 ? 4 : 3;
        return String(Number(v.toFixed(prec)));
    }
    formatScalarValue(v) {
        if (!Number.isFinite(v)) return "";
        const abs = Math.abs(v), prec = abs < .001 ? 6 : abs < 1 ? 4 : 3;
        return String(Number(v.toFixed(prec)));
    }
    _endpointsFromLineExpr(expr) {
        const t = String(expr || "").trim(), cm = t.match(/^([A-Za-zА-Яа-я](?:_\d+)?)\s*,\s*([A-Za-zА-Яа-я](?:_\d+)?)$/), mm = !cm && t.replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/), pm = !cm && !mm && t.match(/^Прямая\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i);
        return cm ? [ cm[1], cm[2] ] : mm ? [ mm[1], mm[2] ] : pm ? [ pm[1].trim(), pm[2].trim() ] : null;
    }
    parseAndApplyInstructions() {
        const textarea = document.getElementById("instruction-input"), results = document.getElementById("instruction-results");
        if (textarea && results && !this._isParsingInstructions) {
            const currentText = textarea.value;
            if (currentText === this._lastInstructionsText) return;
            this._lastInstructionsText = currentText, this._isParsingInstructions = !0;
            try {
                const lines = currentText.split(/\r?\n/);
                this.instructionBuildEpoch = (this.instructionBuildEpoch || 0) + 1, this.clearInstructionOverlays(), 
                results.innerHTML = "", this.namedPoints = {}, this.namedPointMarkers = {}, this.namedPointLabels = {}, 
                this.namedVectors = {}, this.variables = {}, this.variables._edges = {}, this.pointPlacements = {}, 
                this.pointRatioConstraints = {}, this.pointEdgeBary = {}, this.namedLines = {}, 
                this.namedRays = {}, this.namedSegments = {}, this.namedPlanes = {}, this.autoDrawnSegments = new Set;
                const figureType = this.currentFigureType;
                if (this.smoothFigures && this.smoothFigures.has(figureType)) {
                    this.figureGeometry.boundingBox || this.figureGeometry.computeBoundingBox();
                    const bb = this.figureGeometry.boundingBox;
                    if (bb) if ("cylinder" === figureType) {
                        const h = bb.max.y - bb.min.y, centerBottom = new THREE.Vector3(0, 0, 0), centerTop = new THREE.Vector3(0, h, 0);
                        this.addNamedPointMarker("O", centerBottom, 16737792), this.addNamedPointMarker("O_1", centerTop, 16737792);
                    } else if ("cone" === figureType) {
                        const h = bb.max.y - bb.min.y, centerBase = new THREE.Vector3(0, 0, 0);
                        new THREE.Vector3(0, h, 0);
                        this.getPointByName("O") || this.addNamedPointMarker("O", centerBase, 16737792);
                    } else if ("sphere" === figureType) {
                        const r = (bb.max.x - bb.min.x) / 2, center = new THREE.Vector3(0, r, 0);
                        this.addNamedPointMarker("O", center, 16737792);
                    }
                }
                const makeLine = (text, ok, hint = "", valueText = "", constraintIdx = null) => {
                    const el = document.createElement("div");
                    el.className = "instr-line " + (ok ? "ok" : "error"), !ok && hint && (el.title = hint), 
                    null !== constraintIdx && (el.dataset.constraintIdx = String(constraintIdx));
                    const row = document.createElement("div");
                    row.className = "instr-row";
                    const t = document.createElement("span");
                    t.className = "instr-text", this._renderInstructionTextWithKaTeX(t, text);
                    const v = document.createElement("span");
                    v.className = "instr-value";
                    const controls = document.createElement("span");
                    controls.className = "instr-controls";
                    const looksAngle = "string" == typeof valueText && /°\s*$/.test(valueText);
                    let formatSelect = null;
                    looksAngle && (formatSelect = document.createElement("select"), formatSelect.className = "angle-format", 
                    [ "deg", "rad", "arcsin", "arccos", "arctg", "arcctg" ].forEach(k => {
                        const opt = document.createElement("option");
                        opt.value = k, opt.textContent = k, formatSelect.appendChild(opt);
                    }), formatSelect.value = "deg", controls.appendChild(formatSelect));
                    const renderValue = () => {
                        v.innerHTML = "";
                        const s = String(valueText || "").trim();
                        if (s) if (looksAngle) {
                            const degVal = parseFloat(s.replace(/°\s*$/, "")), mode = formatSelect ? formatSelect.value : "deg";
                            if ("deg" === mode) this._renderInstructionValueWithKaTeX(v, `${degVal.toFixed(3)}°`); else if ("rad" === mode) {
                                const rad = degVal * Math.PI / 180, out = this.formatScalarValue(rad);
                                try {
                                    katex.render(out, v, {
                                        throwOnError: !1,
                                        output: "mathml"
                                    });
                                } catch {
                                    v.textContent = out;
                                }
                            } else {
                                const rad = degVal * Math.PI / 180, cosv = Math.cos(rad), sinv = Math.sin(rad), tanv = Math.tan(rad), cotv = Math.abs(sinv) < 1e-12 ? 1 / 0 : 1 / tanv, num = x => this.formatScalarValue(x);
                                let tex = "";
                                "arcsin" === mode ? tex = `\\arcsin(${num(sinv)})` : "arccos" === mode ? tex = `\\arccos(${num(cosv)})` : "arctg" === mode ? tex = `\\operatorname{arctg}(${Math.abs(cosv) < 1e-12 ? "\\text{неопределенно}" : num(tanv)})` : "arcctg" === mode && (tex = `\\operatorname{arcctg}(${Math.abs(sinv) < 1e-12 ? "\\text{неопределенно}" : num(cotv)})`);
                                try {
                                    katex.render(tex, v, {
                                        throwOnError: !1,
                                        strict: "ignore",
                                        output: "mathml"
                                    });
                                } catch {
                                    v.textContent = tex.replace(/\\/g, "");
                                }
                            }
                        } else this._renderInstructionValueWithKaTeX(v, valueText);
                    };
                    looksAngle && formatSelect && formatSelect.addEventListener("change", renderValue), 
                    renderValue(), row.appendChild(t), row.appendChild(v), el.appendChild(row), looksAngle && el.appendChild(controls), 
                    results.appendChild(el);
                }, tryDistanceQuery = s => {
                    const m = s.match(/^\s*(Расстояние|Distance)\s*\(([^)]*)\)\s*=\s*\?\s*$/i);
                    if (!m) return null;
                    const args = m[2].split(",").map(x => x.trim()).filter(Boolean);
                    if (2 !== args.length) return {
                        ok: !1,
                        hint: "Ожидаются два аргумента"
                    };
                    const nameA = args[0], nameB = args[1], p1 = this.getPointByName(nameA), p2 = this.getPointByName(nameB);
                    if (p1 && p2) {
                        const d = p1.distanceTo(p2);
                        return {
                            ok: !0,
                            value: this.formatDistanceValue(d, nameA, nameB)
                        };
                    }
                    return null;
                }, tryLengthQuery = s => {
                    let m = s.match(/^\s*(Длина|Length)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*=\s*\?\s*$/i);
                    if (m) {
                        const nameA = m[2].trim(), nameB = m[3].trim(), A = this.getPointByName(nameA), B = this.getPointByName(nameB);
                        return A && B ? (this._autoDrawSegmentIfNew(nameA, nameB, !0), {
                            ok: !0,
                            value: this.formatDistanceValue(A.distanceTo(B), nameA, nameB)
                        }) : {
                            ok: !1,
                            hint: "Точки не найдены"
                        };
                    }
                    if (m = s.replace(/\s+/g, "").match(/^\|([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)\|=\?$/), 
                    m) {
                        const nameA = m[1], nameB = m[2], A = this.getPointByName(nameA), B = this.getPointByName(nameB);
                        return A && B ? (this._autoDrawSegmentIfNew(nameA, nameB, !0), {
                            ok: !0,
                            value: this.formatDistanceValue(A.distanceTo(B), nameA, nameB)
                        }) : {
                            ok: !1,
                            hint: "Точки не найдены"
                        };
                    }
                    if (m = s.match(/^\s*\|([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\|\s*=\s*\?\s*$/i), 
                    m) {
                        const name = m[1];
                        if (this.namedSegments && this.namedSegments[name]) {
                            const seg = this.namedSegments[name];
                            return {
                                ok: !0,
                                value: this.formatDistanceValue(seg.a.distanceTo(seg.b))
                            };
                        }
                        const edgeRef = this.variables && this.variables._edges && this.variables._edges[name];
                        if (edgeRef) {
                            const edgeMm = String(edgeRef).replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/);
                            if (edgeMm) {
                                const A = this.getPointByName(edgeMm[1]), B = this.getPointByName(edgeMm[2]);
                                if (A && B) return {
                                    ok: !0,
                                    value: this.formatDistanceValue(A.distanceTo(B), edgeMm[1], edgeMm[2])
                                };
                            }
                        }
                        return this.namedLines && this.namedLines[name] ? {
                            ok: !1,
                            hint: "Длина не определена для прямой"
                        } : this.namedRays && this.namedRays[name] ? {
                            ok: !1,
                            hint: "Длина не определена для луча"
                        } : {
                            ok: !1,
                            hint: "Объект не является отрезком"
                        };
                    }
                    return null;
                }, tryGeneratrixQuery = s => {
                    if (!s.match(/^\s*(Образующая)\s*=\s*\?\s*$/i)) return null;
                    const type = this.currentFigureType;
                    if (!type) return {
                        ok: !1,
                        hint: "Фигура не выбрана"
                    };
                    if ("cylinder" === type) {
                        const h = Number(this.figureParams && this.figureParams.height);
                        return h > 0 ? {
                            ok: !0,
                            value: this.formatScalarValue(h)
                        } : {
                            ok: !1,
                            hint: "Высота цилиндра не задана"
                        };
                    }
                    if ("cone" === type) {
                        const r = Number(this.figureParams && this.figureParams.radius), h = Number(this.figureParams && this.figureParams.height);
                        if (!(r > 0 && h > 0)) return {
                            ok: !1,
                            hint: "Параметры конуса не заданы"
                        };
                        const l = Math.sqrt(r * r + h * h);
                        return {
                            ok: !0,
                            value: this.formatScalarValue(l)
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Образующая определена только для конуса и цилиндра"
                    };
                }, tryDiameterRadiusQuery = s => {
                    const m = s.match(/^\s*(Диаметр|Diameter|Радиус|Radius|R|D)\s*\(([^\)]+)\)\s*=\s*\?\s*$/i);
                    if (!m) return null;
                    const type = m[1].toLowerCase(), circleName = m[2].trim(), isDiameter = type.startsWith("d") || "диаметр" === type;
                    if (!this.namedCircles || !this.namedCircles[circleName]) return {
                        ok: !1,
                        hint: `Окружность "${circleName}" не найдена`
                    };
                    const radius = this.namedCircles[circleName].radius, value = isDiameter ? 2 * radius : radius;
                    return {
                        ok: !0,
                        value: this.formatScalarValue(value)
                    };
                }, tryAreaQuery = s => {
                    const m = s.match(/^\s*(Площадь|Площаль|Area)\s*\(([^)]*)\)\s*=\s*\?\s*$/i);
                    if (!m) return null;
                    const inside = m[2], names = (String(inside || "").match(/[A-Za-z](?:_\d+)?/g) || []).map(x => x.trim()).filter(Boolean);
                    if (/^\s*\(.*\)\s*(,\s*\(.*\)\s*)*$/s.test(inside)) {
                        const parsed = this._parseFacesFromString(inside);
                        if (!parsed.ok) return {
                            ok: !1,
                            hint: parsed.hint
                        };
                        const orient = this._validateAndOrientFaces(parsed.facesNames);
                        if (!orient.ok) return {
                            ok: !1,
                            hint: orient.hint
                        };
                        const areaRes = this._computeMeshAreaFromFaces(parsed.facesPoints);
                        return areaRes.ok ? {
                            ok: !0,
                            value: this.formatScalarValue(areaRes.area)
                        } : {
                            ok: !1,
                            hint: areaRes.hint
                        };
                    }
                    const providedSet = new Set(names), figureSet = new Set(this.vertexLabels || []);
                    if (providedSet.size > 0 && figureSet.size > 0 && providedSet.size === figureSet.size && [ ...providedSet ].every(n => figureSet.has(n))) {
                        if (!this.figureGeometry) return {
                            ok: !1,
                            hint: "Фигура не выбрана"
                        };
                        const area = this._computeSurfaceAreaFromGeometry(this.figureGeometry);
                        return {
                            ok: !0,
                            value: this.formatScalarValue(area)
                        };
                    }
                    const secName = String(inside || "").trim();
                    if (this.namedSections && this.namedSections[secName] && Array.isArray(this.namedSections[secName].points)) {
                        const pts = this.namedSections[secName].points;
                        if (pts.length >= 3) {
                            const a = this._polygonAreaFromPoints(pts);
                            return {
                                ok: !0,
                                value: this.formatScalarValue(a)
                            };
                        }
                    }
                    if (names.length >= 3) {
                        const pts = names.map(n => this.getPointByName(n)), missing = names.filter((n, i) => !pts[i]);
                        if (missing.length) return {
                            ok: !1,
                            hint: `Точки не найдены: ${missing.join(", ")}`
                        };
                        if (!this._isPlanar(pts)) return {
                            ok: !1,
                            hint: "Точки не копланарны"
                        };
                        const a = this._polygonAreaFromPoints(pts);
                        return {
                            ok: !0,
                            value: this.formatScalarValue(a)
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Ожидались вершины многоугольника"
                    };
                }, tryCenterDefinition = s => {
                    const m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*Центр\s*\(([^)]*)\)\s*$/i);
                    if (!m) return null;
                    const name = m[1], inside = (m[2] || "").trim(), tokens = (inside.match(/[A-Za-z](?:_\d+)?/g) || []).map(x => x.trim()).filter(Boolean);
                    if (tokens.length > 0) {
                        const pts = tokens.map(n => this.getPointByName(n)), missing = tokens.filter((n, i) => !pts[i]);
                        if (missing.length) return {
                            ok: !1,
                            hint: `Точки не найдены: ${missing.join(", ")}`
                        };
                        const providedSet = new Set(tokens), figureSet = new Set(this.vertexLabels || []);
                        if (providedSet.size > 0 && figureSet.size > 0 && providedSet.size === figureSet.size && [ ...providedSet ].every(n => figureSet.has(n)) && this.figureGeometry && this.figureGeometry.getAttribute) {
                            const pos = this.figureGeometry.getAttribute("position");
                            if (pos && pos.count > 0) {
                                const uniq = new Map, eps = 1e-6;
                                for (let i = 0; i < pos.count; i++) {
                                    const v = (new THREE.Vector3).fromBufferAttribute(pos, i), key = `${Math.round(v.x / eps)},${Math.round(v.y / eps)},${Math.round(v.z / eps)}`;
                                    uniq.has(key) || uniq.set(key, v.clone());
                                }
                                let cx = 0, cy = 0, cz = 0, cnt = 0;
                                if (uniq.forEach(v => {
                                    cx += v.x, cy += v.y, cz += v.z, cnt++;
                                }), cnt > 0) {
                                    const C = new THREE.Vector3(cx / cnt, cy / cnt, cz / cnt);
                                    return this.addNamedPointMarker(name, C, 16737792), {
                                        ok: !0
                                    };
                                }
                            }
                        }
                        const C = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3(0, 0, 0)).multiplyScalar(1 / pts.length);
                        return this.addNamedPointMarker(name, C, 16737792), {
                            ok: !0
                        };
                    }
                    if (!inside.length) {
                        if (!this.figureGeometry) return {
                            ok: !1,
                            hint: "Фигура не выбрана"
                        };
                        const pos = this.figureGeometry.getAttribute && this.figureGeometry.getAttribute("position");
                        if (!pos || !pos.count) return {
                            ok: !1,
                            hint: "Геометрия фигуры отсутствует"
                        };
                        const uniq = new Map, eps = 1e-6;
                        for (let i = 0; i < pos.count; i++) {
                            const v = (new THREE.Vector3).fromBufferAttribute(pos, i), key = `${Math.round(v.x / eps)},${Math.round(v.y / eps)},${Math.round(v.z / eps)}`;
                            uniq.has(key) || uniq.set(key, v.clone());
                        }
                        let cx = 0, cy = 0, cz = 0, cnt = 0;
                        if (uniq.forEach(v => {
                            cx += v.x, cy += v.y, cz += v.z, cnt++;
                        }), cnt > 0) {
                            const C = new THREE.Vector3(cx / cnt, cy / cnt, cz / cnt);
                            return this.addNamedPointMarker(name, C, 16737792), {
                                ok: !0
                            };
                        }
                        return {
                            ok: !1,
                            hint: "Не удалось вычислить центр"
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Ожидались имена вершин или пусто для текущей фигуры"
                    };
                }, tryPerimeterQuery = s => {
                    const m = s.match(/^\s*(Периметр|Perimeter)\s*\(([^)]*)\)\s*=\s*\?\s*$/i);
                    if (!m) return null;
                    const inside = m[2], names = (String(inside || "").match(/[A-Za-z](?:_\d+)?/g) || []).map(x => x.trim()).filter(Boolean);
                    if (/^\s*\(.*\)\s*(,\s*\(.*\)\s*)*$/s.test(inside)) {
                        const parsed = this._parseFacesFromString(inside);
                        if (!parsed.ok) return {
                            ok: !1,
                            hint: parsed.hint
                        };
                        const orient = this._validateAndOrientFaces(parsed.facesNames);
                        if (!orient.ok) return {
                            ok: !1,
                            hint: orient.hint
                        };
                        const perRes = this._computeMeshPerimeterFromFaces(orient.facesNames);
                        return perRes.ok ? {
                            ok: !0,
                            value: this.formatScalarValue(perRes.length)
                        } : {
                            ok: !1,
                            hint: perRes.hint
                        };
                    }
                    const providedSet = new Set(names), figureSet = new Set(this.vertexLabels || []);
                    if (providedSet.size > 0 && figureSet.size > 0 && providedSet.size === figureSet.size && [ ...providedSet ].every(n => figureSet.has(n))) {
                        if (!this.figureGeometry) return {
                            ok: !1,
                            hint: "Фигура не выбрана"
                        };
                        const L = this._computeTotalEdgeLengthFromGeometry(this.figureGeometry);
                        return {
                            ok: !0,
                            value: this.formatScalarValue(L)
                        };
                    }
                    const secName = String(inside || "").trim();
                    if (this.namedSections && this.namedSections[secName] && Array.isArray(this.namedSections[secName].points)) {
                        const pts = this.namedSections[secName].points;
                        if (pts.length >= 3) {
                            const p = this._polygonPerimeterFromPoints(pts);
                            return {
                                ok: !0,
                                value: this.formatScalarValue(p)
                            };
                        }
                    }
                    if (names.length >= 3) {
                        const pts = names.map(n => this.getPointByName(n)), missing = names.filter((n, i) => !pts[i]);
                        if (missing.length) return {
                            ok: !1,
                            hint: `Точки не найдены: ${missing.join(", ")}`
                        };
                        const p = this._polygonPerimeterFromPoints(pts);
                        return {
                            ok: !0,
                            value: this.formatScalarValue(p)
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Ожидались вершины многоугольника"
                    };
                }, tryVolumeQuery = s => {
                    const m = s.match(/^\s*(Объем|Объём|V)\s*\(([^)]*)\)\s*=\s*\?\s*$/i);
                    if (!m) return null;
                    const inside = m[2], names = (String(inside || "").match(/[A-Za-z](?:_\d+)?/g) || []).map(x => x.trim()).filter(Boolean);
                    if (names.length < 4) return {
                        ok: !1,
                        hint: "Для вычисления объёма нужно минимум 4 точки (тетраэдр)"
                    };
                    const pts = names.map(n => this.getPointByName(n)), missing = names.filter((n, i) => !pts[i]);
                    if (missing.length) return {
                        ok: !1,
                        hint: `Точки не найдены: ${missing.join(", ")}`
                    };
                    if (4 === names.length) {
                        const [A, B, C, D] = pts, vol = Math.abs((new THREE.Vector3).crossVectors(B.clone().sub(A), C.clone().sub(A)).dot(D.clone().sub(A))) / 6;
                        return vol > 1e-9 ? {
                            ok: !0,
                            value: this.formatScalarValue(vol)
                        } : {
                            ok: !1,
                            hint: "Точки тетраэдра копланарны (объём = 0)"
                        };
                    }
                    try {
                        const convexGeom = new ConvexGeometry(pts), V = this._computeVolumeFromGeometry(convexGeom);
                        return convexGeom.dispose(), V > 1e-9 ? {
                            ok: !0,
                            value: this.formatScalarValue(V)
                        } : {
                            ok: !1,
                            hint: "Точки не образуют объёмную фигуру"
                        };
                    } catch (e) {
                        return {
                            ok: !1,
                            hint: "Не удалось построить многогранник из заданных точек"
                        };
                    }
                }, tryPointDefinition = s => {
                    const m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(\([^\)]*\))\s*$/);
                    if (!m) return null;
                    const name = m[1], P = this._parsePointToken(m[2]);
                    return P ? (this.addNamedPointMarker(name, P, 16737792), {
                        ok: !0
                    }) : {
                        ok: !1,
                        hint: "Не распознаны координаты"
                    };
                }, tryVariableDefinition = s => {
                    const m = s.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
                    if (!m) return null;
                    const name = m[1];
                    if (this.getPointByName(name) || this.namedLines[name] || this.namedPlanes[name]) return null;
                    const expr = m[2].trim(), edgeMatch = expr.match(/^([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)$/);
                    if (edgeMatch) {
                        const A = this.getPointByName(edgeMatch[1]), B = this.getPointByName(edgeMatch[2]);
                        if (A && B) {
                            const distance = A.distanceTo(B);
                            return this.variables[name] = distance, this.variables._edges || (this.variables._edges = {}), 
                            this.variables._edges[name] = expr, {
                                ok: !0
                            };
                        }
                    }
                    const val = this._evaluateExpression(expr);
                    return null == val ? null : (this.variables[name] = val, {
                        ok: !0
                    });
                }, tryConstraintConstruct = s => {
                    const m = s.match(/^\s*\]\s*(плоскость|plane|прямая|line)\s+([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*\?\s*:\s*(.+)$/i);
                    if (!m) return null;
                    const kind = m[1].toLowerCase(), name = m[2], facts = m[3].split(/;|,/).map(x => x.trim()).filter(Boolean), constraints = {
                        throughPoints: [],
                        parallelDirs: [],
                        perpDirs: [],
                        containsLines: []
                    };
                    for (const f of facts) {
                        let mm = f.match(/^([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*(∈|\bпринадлежит\b)\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/i);
                        if (mm) {
                            const P = this.getPointByName(mm[1]);
                            P && mm[3] === name && constraints.throughPoints.push(P);
                            continue;
                        }
                        if (mm = f.match(/^(.+)\s*(∥|⟂)\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/), 
                        mm && mm[3] === name) {
                            const edge = this._parseEdgeOrVariable(mm[1].replace(/\s+/g, ""), !0);
                            if (edge) {
                                const dir = edge.B.clone().sub(edge.A);
                                kind.startsWith("плоск"), "∥" === mm[2] ? constraints.parallelDirs.push(dir) : constraints.perpDirs.push(dir);
                                continue;
                            }
                        }
                        if (mm = f.match(/^([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*(∥|⟂)\s*(.+)$/), 
                        mm && mm[1] === name) {
                            const edge = this._parseEdgeOrVariable(mm[3].replace(/\s+/g, ""));
                            if (edge) {
                                const dir = edge.B.clone().sub(edge.A);
                                "∥" === mm[2] ? constraints.parallelDirs.push(dir) : constraints.perpDirs.push(dir);
                                continue;
                            }
                            if (this.namedLines[mm[3]]) {
                                const dir = this.namedLines[mm[3]].dir.clone();
                                "∥" === mm[2] ? constraints.parallelDirs.push(dir) : constraints.perpDirs.push(dir);
                                continue;
                            }
                        }
                        if (mm = f.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(∥|⟂)\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/), 
                        mm && mm[3] === name) {
                            const lname = mm[1];
                            if (this.namedLines[lname]) {
                                const dir = this.namedLines[lname].dir.clone();
                                "∥" === mm[2] ? constraints.parallelDirs.push(dir) : constraints.perpDirs.push(dir);
                                continue;
                            }
                        }
                        if (mm = f.match(/^([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*(∥|⟂)\s*([A-Za-z_][A-Za-z0-9_]*)$/), 
                        mm && mm[1] === name) {
                            const lname = mm[3];
                            if (this.namedLines[lname]) {
                                const dir = this.namedLines[lname].dir.clone();
                                "∥" === mm[2] ? constraints.parallelDirs.push(dir) : constraints.perpDirs.push(dir);
                                continue;
                            }
                        }
                        if (kind.startsWith("плоск") || "plane" === kind) {
                            if (mm = f.match(/^(.+)\s*(∥|⟂)\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/), 
                            mm && mm[3] === name) {
                                const planeRef = mm[1].trim(), rel = mm[2], planeExpr = this._parsePlaneExpr(planeRef);
                                if (planeExpr.ok) {
                                    const normal = planeExpr.plane.normal.clone();
                                    "∥" === rel ? constraints.perpDirs.push(normal) : constraints.parallelDirs.push(normal);
                                }
                                continue;
                            }
                            if (mm = f.match(/^([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*(∥|⟂)\s*(.+)$/), 
                            mm && mm[1] === name) {
                                const planeRef = mm[3].trim(), rel = mm[2], planeExpr = this._parsePlaneExpr(planeRef);
                                if (planeExpr.ok) {
                                    const normal = planeExpr.plane.normal.clone();
                                    "∥" === rel ? constraints.perpDirs.push(normal) : constraints.parallelDirs.push(normal);
                                }
                                continue;
                            }
                        }
                        if (mm = f.match(/^(.+)\s*(⊂|\bлежит\s*на\b)\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/i), 
                        mm && mm[3] === name) {
                            const edge = this._parseEdgeOrVariable(mm[1].replace(/\s+/g, ""));
                            edge && constraints.containsLines.push({
                                A: edge.A,
                                B: edge.B
                            });
                            continue;
                        }
                    }
                    if (kind.startsWith("плоск") || "plane" === kind) {
                        let plane = null;
                        if (constraints.throughPoints.length >= 3) {
                            const [A, B, C] = constraints.throughPoints, r = this._planeFromThreePoints(A, B, C);
                            r.ok && (plane = r);
                        }
                        if (!plane && constraints.containsLines.length >= 2) {
                            const L1 = constraints.containsLines[0], L2 = constraints.containsLines[1], p1 = this._lineFromTwoPoints(L1.A, L1.B), p2 = this._lineFromTwoPoints(L2.A, L2.B), cop = this._intersectLines3D(p1.point, p1.point.clone().add(p1.dir), p2.point, p2.point.clone().add(p2.dir));
                            if (cop.ok) {
                                const n = (new THREE.Vector3).crossVectors(p1.dir, p2.dir);
                                plane = this._planeFromPointNormal(cop.point, n);
                            } else {
                                const n = (new THREE.Vector3).crossVectors(p1.dir, p2.point.clone().sub(p1.point));
                                plane = this._planeFromPointNormal(p1.point, n);
                            }
                        }
                        if (!plane && constraints.throughPoints.length >= 1) {
                            const P = constraints.throughPoints[0], Q = constraints.throughPoints.length >= 2 ? constraints.throughPoints[1] : null, inPlaneDirs = [];
                            constraints.containsLines.forEach(L => inPlaneDirs.push(L.B.clone().sub(L.A))), 
                            constraints.parallelDirs.forEach(d => inPlaneDirs.push(d.clone()));
                            const perpDir = constraints.perpDirs.length ? constraints.perpDirs[0].clone() : null;
                            if (Q && perpDir) {
                                const pq = Q.clone().sub(P), n = (new THREE.Vector3).crossVectors(pq, perpDir).normalize();
                                n.lengthSq() > 1e-10 && (plane = this._planeFromPointNormal(P, n));
                            }
                            if (!plane && Q && inPlaneDirs.length) {
                                const pq = Q.clone().sub(P);
                                let chosen = null;
                                for (const d of inPlaneDirs) if (d.clone().normalize().cross(pq.clone().normalize()).lengthSq() > 1e-6) {
                                    chosen = d;
                                    break;
                                }
                                if (chosen) {
                                    const n = (new THREE.Vector3).crossVectors(pq, chosen);
                                    plane = this._planeFromPointNormal(P, n);
                                }
                            }
                            if (!plane && Q) {
                                const pq = Q.clone().sub(P);
                                let helper = new THREE.Vector3(0, 1, 0);
                                pq.clone().normalize().dot(helper) > .95 && (helper = new THREE.Vector3(1, 0, 0));
                                const n = (new THREE.Vector3).crossVectors(pq, helper);
                                plane = this._planeFromPointNormal(P, n);
                            }
                            if (!plane && perpDir && (plane = this._planeFromPointNormal(P, perpDir)), !plane) if (inPlaneDirs.length >= 2) {
                                const n = (new THREE.Vector3).crossVectors(inPlaneDirs[0], inPlaneDirs[1]);
                                plane = this._planeFromPointNormal(P, n);
                            } else if (inPlaneDirs.length >= 1) {
                                const dir = inPlaneDirs[0];
                                let helper = new THREE.Vector3(1, 0, 0);
                                Math.abs(dir.clone().normalize().dot(helper)) > .9 && (helper = new THREE.Vector3(0, 1, 0));
                                const n = (new THREE.Vector3).crossVectors(dir, helper);
                                plane = this._planeFromPointNormal(P, n);
                            }
                        }
                        return plane && plane.ok ? (this.namedPlanes[name] = plane, this.createOverlayPlane(plane.point, plane.normal, 4, 2003199, .12), 
                        {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Недостаточно фактов для построения плоскости"
                        };
                    }
                    if (constraints.containsLines.length >= 1) {
                        const L = constraints.containsLines[0], line = this._lineFromTwoPoints(L.A, L.B);
                        return this.namedLines[name] = line, this.createOverlayInfiniteLine(line.point, line.dir, "#00aa88"), 
                        {
                            ok: !0
                        };
                    }
                    if (constraints.throughPoints.length >= 2) {
                        const line = this._lineFromTwoPoints(constraints.throughPoints[0], constraints.throughPoints[1]);
                        return this.namedLines[name] = line, this.createOverlayInfiniteLine(line.point, line.dir, "#00aa88"), 
                        {
                            ok: !0
                        };
                    }
                    if (constraints.throughPoints.length >= 1) {
                        const P = constraints.throughPoints[0];
                        let dir = null;
                        if (constraints.parallelDirs.length && (dir = constraints.parallelDirs[0].clone()), 
                        !dir && constraints.perpDirs.length && this.namedPlanes[name], dir) {
                            const line = {
                                point: P.clone(),
                                dir: dir
                            };
                            return this.namedLines[name] = line, this.createOverlayInfiniteLine(line.point, line.dir, "#00aa88"), 
                            {
                                ok: !0
                            };
                        }
                    }
                    return {
                        ok: !1,
                        hint: "Недостаточно фактов для построения прямой"
                    };
                }, tryVectorDefinition = s => {
                    const m = s.match(/^\s*([A-Za-z][\w_]*)\s*=\s*(.+)$/);
                    if (!m) return null;
                    const name = m[1], expr = m[2].trim(), t = expr.trim();
                    if (!(/^<[^>]+>$/.test(t) || /^(Вектор|Направление)\s*\(/i.test(t) || this.namedVectors[t])) return null;
                    const v = this._parseVectorToken(expr);
                    if (!v) return {
                        ok: !1,
                        hint: "Не распознан вектор"
                    };
                    this.namedVectors[name] = v.clone();
                    const O = new THREE.Vector3(0, 0, 0);
                    return this.createOverlayLineSegment(O, O.clone().add(v.clone().normalize()), "#ffaa00"), 
                    {
                        ok: !0
                    };
                }, tryLineRaySegPlaneDefinition = s => {
                    const m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(.+)$/);
                    if (!m) return null;
                    const name = m[1], expr = m[2].trim();
                    let r = this._parseLineExpr(expr);
                    if (r.ok) return this.namedLines[name] = r.line, r.line.pointNames, this.createOverlayInfiniteLine(r.line.point, r.line.dir, "#00aa88"), 
                    {
                        ok: !0
                    };
                    if (r = this._parseRayExpr(expr), r.ok) return this.namedRays[name] = r.ray, this.createOverlayRay(r.ray.origin, r.ray.dir, "#00aa88"), 
                    {
                        ok: !0
                    };
                    if (r = this._parseSegmentExpr(expr), r.ok) return this.namedSegments[name] = r.segment, 
                    this.createOverlayLineSegment(r.segment.a, r.segment.b, "#00aa88"), {
                        ok: !0
                    };
                    if (r = this._parsePlaneExpr(expr), r.ok) {
                        this.namedPlanes[name] = r.plane;
                        const pointNames = this._extractThreePointNames(expr);
                        return pointNames && (this.namedPlanes[name].pointNames = pointNames), this.createOverlayPlane(r.plane.point, r.plane.normal, 4, 2003199, .12), 
                        {
                            ok: !0
                        };
                    }
                    return /^\s*Плоскость\s*\(/i.test(expr) || /^\s*[A-Za-zА-Яа-я](?:_\d+)?\s*,\s*[A-Za-zА-Яа-я](?:_\d+)?\s*,\s*[A-Za-zА-Яа-я](?:_\d+)?\s*$/.test(expr) || /^\s*[A-Za-zА-Яа-я](?:_\d+)?[A-Za-zА-Яа-я](?:_\d+)?[A-Za-zА-Яа-я](?:_\d+)?\s*$/.test(expr) ? {
                        ok: !1,
                        hint: r && r.hint ? r.hint : "Плоскость не распознана"
                    } : null;
                }, tryMidpointDivision = s => {
                    let m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(Середина|сер)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i);
                    if (m) {
                        const name = m[1], A = this._parsePointToken(m[3]), B = this._parsePointToken(m[4]);
                        if (!A || !B) return {
                            ok: !1,
                            hint: "Точки не найдены"
                        };
                        const M = A.clone().add(B).multiplyScalar(.5);
                        return this.addNamedPointMarker(name, M, 16763904), this.createOverlayLineSegment(A, B, "#00aa00", !0), 
                        {
                            ok: !0
                        };
                    }
                    if (m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(ДелениеВнутр|ВнешнееДеление)\s*\(([^,]+)\s*,\s*([^;\)]+)\s*;\s*([^\)]+)\)\s*$/i), 
                    m) {
                        const name = m[1], type = m[2].toLowerCase(), A = this._parsePointToken(m[3]), B = this._parsePointToken(m[4]), t = parseFloat(m[5]);
                        if (!A || !B || !Number.isFinite(t)) return {
                            ok: !1,
                            hint: "Неверные аргументы"
                        };
                        let X;
                        if (type.startsWith("делениевнутр")) X = A.clone().multiplyScalar(1 - t).add(B.clone().multiplyScalar(t)); else {
                            const k = t / (t - 1);
                            X = A.clone().add(B.clone().sub(A).multiplyScalar(k));
                        }
                        return this.addNamedPointMarker(name, X, 16763904), this.createOverlayLineSegment(A, B, "#00aa00", !0), 
                        {
                            ok: !0
                        };
                    }
                    return null;
                }, tryPolyline = s => {
                    const m = s.match(/^\s*Ломаная\s*\(([^\)]*)\)\s*$/i);
                    if (!m) return null;
                    const pts = m[1].split(",").map(x => x.trim()).filter(Boolean).map(n => this._parsePointToken(n)).filter(Boolean);
                    return pts.length < 2 ? {
                        ok: !1,
                        hint: "Мало точек"
                    } : (this.createOverlayPolyline(pts, "#228b22"), {
                        ok: !0
                    });
                }, trySection = s => {
                    let m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*Сечение\s*\(([^)]+)\)\s*$/i), assignedName = null, arg = null;
                    if (m) assignedName = m[1], arg = m[2].trim(); else {
                        if (m = s.match(/^\s*Сечение\s*\(([^)]+)\)\s*$/i), !m) return null;
                        arg = m[1].trim();
                    }
                    let planeDef = null;
                    const names = this._extractThreePointNames(arg);
                    if (names) {
                        const res = this._getThreePoints(names);
                        if (!res.ok) return res;
                        planeDef = res.points.map(p => p.clone());
                    } else {
                        const nameTok = String(arg || "").trim(), pl = this.namedPlanes && this.namedPlanes[nameTok] ? this.namedPlanes[nameTok] : null;
                        if (!pl) return {
                            ok: !1,
                            hint: "Ожидались три точки или имя ранее определённой плоскости"
                        };
                        const P = pl.point.clone(), n = pl.normal.clone().normalize();
                        let axis = new THREE.Vector3(1, 0, 0);
                        Math.abs(n.dot(axis)) > .9 && (axis = new THREE.Vector3(0, 1, 0));
                        const u = (new THREE.Vector3).crossVectors(n, axis).normalize(), v = (new THREE.Vector3).crossVectors(n, u).normalize();
                        planeDef = [ P.clone(), P.clone().add(u), P.clone().add(v) ];
                    }
                    const shown = this.showSectionFromPlaneDef(planeDef, !1);
                    return shown ? (assignedName && (this.namedSections[assignedName] = {
                        planeDef: planeDef.map(p => p.clone()),
                        points: (shown.points || []).map(p => p.clone())
                    }), {
                        ok: !0
                    }) : {
                        ok: !1,
                        hint: "Плоскость не пересекает фигуру"
                    };
                }, _parsePointList = inside => {
                    const s = String(inside || "").trim();
                    return s ? s.includes(",") ? s.split(",").map(x => x.trim()).filter(Boolean).map(n => this._parsePointToken(n)).filter(Boolean) : (s.match(/[A-Za-z](?:_\d+)?/g) || []).map(t => this.getPointByName(t)).filter(Boolean) : [];
                }, tryInscribeCircumscribe2D = s => {
                    let m = s.match(/^\s*(Описать|Вписать)\s*\(([^\)]*)\)\s*$/i);
                    if (!m) return null;
                    const kind = m[1].toLowerCase(), pts = _parsePointList(m[2]);
                    if (pts.length < 3) return {
                        ok: !1,
                        hint: "Минимум 3 точки"
                    };
                    if (!this._isPlanar(pts)) return {
                        ok: !1,
                        hint: "Точки не копланарны"
                    };
                    if (3 === pts.length) {
                        const [A, B, C] = pts;
                        if (kind.startsWith("описать")) {
                            const r = this._triangleCircumcenter(A, B, C);
                            if (!r.ok) return {
                                ok: !1,
                                hint: "Окружность не определена"
                            };
                            this.createOverlayCircle(r.center, r.normal, r.radius, 16753920);
                            const cname = this._allocCenterLabel();
                            return this.addNamedPointMarker(cname, r.center, 16737792), {
                                ok: !0
                            };
                        }
                        {
                            const r = this._triangleIncenter(A, B, C);
                            if (!r.ok) return {
                                ok: !1,
                                hint: "Вписанная окружность не определена"
                            };
                            this.createOverlayCircle(r.center, r.normal, r.radius, 16753920);
                            const cname = this._allocCenterLabel();
                            return this.addNamedPointMarker(cname, r.center, 16737792), {
                                ok: !0
                            };
                        }
                    }
                    if (kind.startsWith("описать")) {
                        const r = this._polygonCircumcircleFromVertices(pts);
                        if (!r.ok) return {
                            ok: !1,
                            hint: r.hint || "Многоугольник не циклический"
                        };
                        this.createOverlayCircle(r.center, r.normal, r.radius, 16753920);
                        const cname = this._allocCenterLabel();
                        return this.addNamedPointMarker(cname, r.center, 16737792), {
                            ok: !0
                        };
                    }
                    {
                        const r = this._polygonIncircleFromVertices(pts);
                        if (!r.ok) return {
                            ok: !1,
                            hint: r.hint || "Многоугольник не касательный"
                        };
                        this.createOverlayCircle(r.center, r.normal, r.radius, 16753920);
                        const cname = this._allocCenterLabel();
                        return this.addNamedPointMarker(cname, r.center, 16737792), {
                            ok: !0
                        };
                    }
                }, tryInscribeCircumscribe3D = s => {
                    const m = s.match(/^\s*(ОписатьСтерео|ВписатьСтерео)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i);
                    if (!m) return null;
                    const kind = m[1].toLowerCase(), obj = m[2].trim(), figure = m[3].trim().toLowerCase();
                    if ("сфера" !== figure && "sphere" !== figure) return {
                        ok: !1,
                        hint: "Пока поддерживается только сфера"
                    };
                    const mm = obj.replace(/\s+/g, "").match(/^([A-Za-z](?:_\d+)?)\s*([A-Za-z](?:_\d+)?)\s*([A-Za-z](?:_\d+)?)\s*([A-Za-z](?:_\d+)?)$/);
                    if (!mm) return {
                        ok: !1,
                        hint: "Ожидается 4 точки тетраэдра"
                    };
                    const A = this.getPointByName(mm[1]), B = this.getPointByName(mm[2]), C = this.getPointByName(mm[3]), D = this.getPointByName(mm[4]);
                    if (!(A && B && C && D)) return {
                        ok: !1,
                        hint: "Точки тетраэдра не найдены"
                    };
                    if (kind.startsWith("описать")) {
                        const r = this._tetraCircumsphere(A, B, C, D);
                        if (!r.ok) return {
                            ok: !1,
                            hint: "Сфера не определена"
                        };
                        this.createOverlaySphere(r.center, r.radius, 16753920);
                        const cname = this._allocCenterLabel();
                        return this.addNamedPointMarker(cname, r.center, 16737792), {
                            ok: !0
                        };
                    }
                    {
                        const r = this._tetraInsphere(A, B, C, D);
                        if (!r.ok) return {
                            ok: !1,
                            hint: "Вписанная сфера не определена"
                        };
                        this.createOverlaySphere(r.center, r.radius, 16753920);
                        const cname = this._allocCenterLabel();
                        return this.addNamedPointMarker(cname, r.center, 16737792), {
                            ok: !0
                        };
                    }
                }, tryColCoplanar = s => {
                    let m = s.match(/^\s*Коллинеарны\s*\(([^\)]*)\)\s*$/i);
                    if (m) {
                        const pts = m[1].split(",").map(x => this._parsePointToken(x.trim())).filter(Boolean);
                        if (pts.length < 3) return {
                            ok: !1,
                            hint: "Минимум 3 точки"
                        };
                        const v = pts[1].clone().sub(pts[0]);
                        for (let i = 2; i < pts.length; i++) {
                            const w = pts[i].clone().sub(pts[0]);
                            if ((new THREE.Vector3).crossVectors(v, w).length() > 1e-6) return {
                                ok: !1,
                                hint: "Не коллинеарны"
                            };
                        }
                        return {
                            ok: !0
                        };
                    }
                    if (m = s.match(/^\s*Копланарны\s*\(([^\)]*)\)\s*$/i), m) {
                        const pts = m[1].split(",").map(x => this._parsePointToken(x.trim())).filter(Boolean);
                        if (pts.length < 4) return {
                            ok: !1,
                            hint: "Минимум 4 точки"
                        };
                        (new THREE.Vector3).crossVectors(pts[1].clone().sub(pts[0]), pts[2].clone().sub(pts[0]));
                        for (let i = 3; i < pts.length; i++) if (Math.abs((new THREE.Matrix3).set(pts[1].x - pts[0].x, pts[1].y - pts[0].y, pts[1].z - pts[0].z, pts[2].x - pts[0].x, pts[2].y - pts[0].y, pts[2].z - pts[0].z, pts[i].x - pts[0].x, pts[i].y - pts[0].y, pts[i].z - pts[0].z).determinant()) > 1e-6) return {
                            ok: !1,
                            hint: "Не копланарны"
                        };
                        return {
                            ok: !0
                        };
                    }
                    return null;
                }, tryProjections = s => {
                    let m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(?:Проекция|Пр)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i);
                    if (m) {
                        const name = m[1], arg1 = m[2].trim(), arg2 = m[3].trim(), P = this._parsePointToken(arg1), l1 = this._parseLineExpr(arg1), r1 = this._parseRayExpr(arg1), s1 = this._parseSegmentExpr(arg1), l2 = this._parseLineExpr(arg2), rp = this._parsePlaneExpr(arg2);
                        if (P && l2.ok) {
                            const pr = this._projectPointOnLine(P, l2.line);
                            return pr.ok ? (this.addNamedPointMarker(name, pr.point, 16763904), this.createOverlayInfiniteLine(l2.line.point, l2.line.dir, "#00aa88"), 
                            {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Проекция не вычислена"
                            };
                        }
                        if (P && rp.ok) {
                            const pr = this._projectPointOnPlane(P, rp.plane);
                            return pr.ok ? (this.addNamedPointMarker(name, pr.point, 16763904), this.createOverlayPlane(rp.plane.point, rp.plane.normal, 4, 2003199, .12), 
                            {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Проекция не вычислена"
                            };
                        }
                        let srcLine = null;
                        if (l1.ok ? srcLine = l1.line : r1.ok ? srcLine = {
                            point: r1.ray.origin.clone(),
                            dir: r1.ray.dir.clone()
                        } : s1.ok && (srcLine = this._lineFromTwoPoints(s1.segment.a, s1.segment.b)), srcLine && rp.ok) {
                            const dirProj = this._projectVectorOnPlane(srcLine.dir, rp.plane);
                            if (dirProj.length() < 1e-9) {
                                const pr = this._projectPointOnPlane(srcLine.point, rp.plane);
                                return pr.ok ? (this.addNamedPointMarker(name, pr.point, 16763904), this.createOverlayInfiniteLine(srcLine.point, srcLine.dir, "#888888"), 
                                this.createOverlayPlane(rp.plane.point, rp.plane.normal, 4, 2003199, .12), {
                                    ok: !0
                                }) : {
                                    ok: !1,
                                    hint: "Проекция не вычислена"
                                };
                            }
                            const pr = this._projectPointOnPlane(srcLine.point, rp.plane), projLine = {
                                point: pr.ok ? pr.point : srcLine.point.clone(),
                                dir: dirProj.clone().normalize()
                            };
                            return this.namedLines[name] = projLine, this.createOverlayInfiniteLine(projLine.point, projLine.dir, "#00aa88"), 
                            this.createOverlayInfiniteLine(srcLine.point, srcLine.dir, "#888888"), this.createOverlayPlane(rp.plane.point, rp.plane.normal, 4, 2003199, .12), 
                            {
                                ok: !0
                            };
                        }
                        return {
                            ok: !1,
                            hint: "Ожидались: точка/прямая, прямая/плоскость"
                        };
                    }
                    return null;
                }, tryIntersections = s => {
                    let m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*([^∩]+)∩([^∩]+)\s*$/);
                    if (m) {
                        const name = m[1], e1 = m[2].trim(), e2 = m[3].trim(), l1 = this._parseLineExpr(e1), l2 = this._parseLineExpr(e2), p1 = this._parsePlaneExpr(e1), p2 = this._parsePlaneExpr(e2);
                        if (l1.ok && p2.ok) {
                            const r = this._intersectLinePlane(l1.line, p2.plane);
                            return r.ok ? (this.addNamedPointMarker(name, r.point, 16763904), this.createOverlayInfiniteLine(l1.line.point, l1.line.dir, "#00aa88"), 
                            this.createOverlayPlane(p2.plane.point, p2.plane.normal, 4, 2003199, .12), {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Прямая параллельна плоскости или лежит в ней"
                            };
                        }
                        if (p1.ok && l2.ok) {
                            const r = this._intersectLinePlane(l2.line, p1.plane);
                            return r.ok ? (this.addNamedPointMarker(name, r.point, 16763904), this.createOverlayInfiniteLine(l2.line.point, l2.line.dir, "#00aa88"), 
                            this.createOverlayPlane(p1.plane.point, p1.plane.normal, 4, 2003199, .12), {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Прямая параллельна плоскости или лежит в ней"
                            };
                        }
                        if (p1.ok && p2.ok) {
                            const r = this._intersectPlanes(p1.plane, p2.plane);
                            return r.ok ? (this.namedLines[name] = r.line, this.createOverlayInfiniteLine(r.line.point, r.line.dir, "#00aa88"), 
                            this.createOverlayPlane(p1.plane.point, p1.plane.normal, 3, 2003199, .08), this.createOverlayPlane(p2.plane.point, p2.plane.normal, 3, 2003199, .08), 
                            {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Плоскости параллельны"
                            };
                        }
                        if (l1.ok && l2.ok) {
                            const P = this._intersectLines3D(l1.line.point, l1.line.point.clone().add(l1.line.dir), l2.line.point, l2.line.point.clone().add(l2.line.dir));
                            return P.ok ? (this.addNamedPointMarker(name, P.point, 16763904), {
                                ok: !0
                            }) : {
                                ok: !1,
                                hint: "Прямые не пересекаются"
                            };
                        }
                    }
                    if (m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*Пересечение\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i), 
                    !m) return null;
                    const name = m[1], e1 = m[2].trim(), e2 = m[3].trim();
                    let l1 = this._parseLineExpr(e1), l2 = this._parseLineExpr(e2);
                    if (l1.ok && l2.ok) {
                        const P = this._intersectLines3D(l1.line.point, l1.line.point.clone().add(l1.line.dir), l2.line.point, l2.line.point.clone().add(l2.line.dir));
                        return P.ok ? (this.addNamedPointMarker(name, P.point, 16763904), this.createOverlayInfiniteLine(l1.line.point, l1.line.dir, "#00aa88"), 
                        this.createOverlayInfiniteLine(l2.line.point, l2.line.dir, "#00aa88"), {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Прямые не пересекаются"
                        };
                    }
                    let lp1 = this._parseLineExpr(e1), pp2 = this._parsePlaneExpr(e2);
                    if (lp1.ok && pp2.ok) {
                        const r = this._intersectLinePlane(lp1.line, pp2.plane);
                        return r.ok ? (this.addNamedPointMarker(name, r.point, 16763904), this.createOverlayInfiniteLine(lp1.line.point, lp1.line.dir, "#00aa88"), 
                        this.createOverlayPlane(pp2.plane.point, pp2.plane.normal, 4, 2003199, .12), {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Нет пересечения"
                        };
                    }
                    let pp1 = this._parsePlaneExpr(e1), ppB = this._parsePlaneExpr(e2);
                    if (pp1.ok && ppB.ok) {
                        const r = this._intersectPlanes(pp1.plane, ppB.plane);
                        return r.ok ? (this.namedLines[name] = r.line, this.createOverlayInfiniteLine(r.line.point, r.line.dir, "#00aa88"), 
                        this.createOverlayPlane(pp1.plane.point, pp1.plane.normal, 3, 2003199, .08), this.createOverlayPlane(ppB.plane.point, ppB.plane.normal, 3, 2003199, .08), 
                        {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Плоскости параллельны"
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Неподдерживаемые аргументы пересечения"
                    };
                }, tryPredicatesAndAngles = s => {
                    let m = s.match(/^\s*(Угол|∠)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*=\s*\?\s*$/i);
                    if (m) {
                        const e1 = m[2].trim(), e2 = m[3].trim(), l1 = this._parseLineExpr(e1), l2 = this._parseLineExpr(e2);
                        if (l1.ok && l2.ok) {
                            const deg = this._angleBetweenVectorsDegrees(l1.line.dir, l2.line.dir), inter = this._intersectLines3D(l1.line.point, l1.line.point.clone().add(l1.line.dir), l2.line.point, l2.line.point.clone().add(l2.line.dir));
                            if (inter && inter.ok) {
                                const r = .8 * this._estimateOverlayScale(.25);
                                this.createAngleArc(inter.point, l1.line.dir, l2.line.dir, r, 16737792);
                            }
                            return this.createOverlayInfiniteLine(l1.line.point, l1.line.dir, "#ff8800"), this.createOverlayInfiniteLine(l2.line.point, l2.line.dir, "#ff8800"), 
                            {
                                ok: !0,
                                value: `${deg.toFixed(3)}°`
                            };
                        }
                        const lp = this._parseLineExpr(e1), pp = this._parsePlaneExpr(e2);
                        if (lp.ok && pp.ok) {
                            const deg = this._angleLinePlaneDegrees(lp.line, pp.plane), intr = this._intersectLinePlane(lp.line, pp.plane);
                            if (intr && intr.ok) {
                                const projectedDir = this._projectVectorOnPlane(lp.line.dir, pp.plane), r = .8 * this._estimateOverlayScale(.25);
                                this.createAngleArc(intr.point, lp.line.dir, projectedDir, r, 16737792);
                            }
                            return this.createOverlayInfiniteLine(lp.line.point, lp.line.dir, "#ff8800"), this.createOverlayPlane(pp.plane.point, pp.plane.normal, 3, 2003199, .08), 
                            {
                                ok: !0,
                                value: `${deg.toFixed(3)}°`
                            };
                        }
                        const pp2 = this._parsePlaneExpr(e1), lp2 = this._parseLineExpr(e2);
                        if (pp2.ok && lp2.ok) {
                            const deg = this._angleLinePlaneDegrees(lp2.line, pp2.plane), intr2 = this._intersectLinePlane(lp2.line, pp2.plane);
                            if (intr2 && intr2.ok) {
                                const projectedDir = this._projectVectorOnPlane(lp2.line.dir, pp2.plane), r = .8 * this._estimateOverlayScale(.25);
                                this.createAngleArc(intr2.point, lp2.line.dir, projectedDir, r, 16737792);
                            }
                            return this.createOverlayInfiniteLine(lp2.line.point, lp2.line.dir, "#ff8800"), 
                            this.createOverlayPlane(pp2.plane.point, pp2.plane.normal, 3, 2003199, .08), {
                                ok: !0,
                                value: `${deg.toFixed(3)}°`
                            };
                        }
                        const p1 = this._parsePlaneExpr(e1), p2 = this._parsePlaneExpr(e2);
                        if (p1.ok && p2.ok) {
                            const deg = this._anglePlanePlaneDegrees(p1.plane, p2.plane), origin = new THREE.Vector3(0, 0, 0);
                            if (this.figureGeometry) {
                                this.figureGeometry.boundingBox || this.figureGeometry.computeBoundingBox();
                                const bbox = this.figureGeometry.boundingBox;
                                bbox && origin.set((bbox.max.x + bbox.min.x) / 2, (bbox.max.y + bbox.min.y) / 2, (bbox.max.z + bbox.min.z) / 2);
                            }
                            return this.createAngleArc(origin, p1.plane.normal, p2.plane.normal, .8, 16737792), 
                            this.createOverlayPlane(p1.plane.point, p1.plane.normal, 3, 2003199, .08), this.createOverlayPlane(p2.plane.point, p2.plane.normal, 3, 16750848, .08), 
                            {
                                ok: !0,
                                value: `${deg.toFixed(3)}°`
                            };
                        }
                        return {
                            ok: !1,
                            hint: "Ожидаются пары: прямая/прямая, прямая/плоскость, плоскость/плоскость"
                        };
                    }
                    if (m = s.match(/^\s*УравнениеПлоскости\s*\(([^\)]*)\)\s*=\s*\?\s*$/i), m) {
                        const rp = this._parsePlaneExpr(m[1]);
                        if (!rp.ok) return {
                            ok: !1,
                            hint: "Плоскость не распознана"
                        };
                        const eq = this._planeEquation(rp.plane);
                        return {
                            ok: !0,
                            value: `${eq.a.toFixed(3)}x+${eq.b.toFixed(3)}y+${eq.c.toFixed(3)}z+${eq.d.toFixed(3)}=0`
                        };
                    }
                    if (m = s.match(/^\s*Расстояние\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*=\s*\?\s*$/i), m) {
                        const a = m[1].trim(), b = m[2].trim(), A = this._parsePointToken(a), B = this._parsePointToken(b);
                        if (A && B) return {
                            ok: !0,
                            value: this.formatDistanceValue(A.distanceTo(B))
                        };
                        const l1 = this._parseLineExpr(a), l2 = this._parseLineExpr(b);
                        if (A && l2.ok) {
                            const dist = this._distancePointLine(A, l2.line);
                            return {
                                ok: !0,
                                value: this.formatDistanceValue(dist)
                            };
                        }
                        if (B && l1.ok) {
                            const dist = this._distancePointLine(B, l1.line);
                            return {
                                ok: !0,
                                value: this.formatDistanceValue(dist)
                            };
                        }
                        const p1 = this._parsePlaneExpr(a), p2 = this._parsePlaneExpr(b);
                        if (A && p2.ok) {
                            const dist = this._distancePointPlane(A, p2.plane);
                            return {
                                ok: !0,
                                value: this.formatDistanceValue(dist)
                            };
                        }
                        if (B && p1.ok) {
                            const dist = this._distancePointPlane(B, p1.plane);
                            return {
                                ok: !0,
                                value: this.formatDistanceValue(dist)
                            };
                        }
                        return l1.ok && l2.ok ? {
                            ok: !0,
                            value: this.formatDistanceValue(this._distanceLineLine(l1.line, l2.line))
                        } : l1.ok && p2.ok ? {
                            ok: !0,
                            value: this.formatDistanceValue(this._distanceLinePlane(l1.line, p2.plane))
                        } : p1.ok && l2.ok ? {
                            ok: !0,
                            value: this.formatDistanceValue(this._distanceLinePlane(l2.line, p1.plane))
                        } : p1.ok && p2.ok ? {
                            ok: !0,
                            value: this.formatDistanceValue(this._distancePlanePlane(p1.plane, p2.plane))
                        } : {
                            ok: !1,
                            hint: "Аргументы не распознаны как точка/прямая/плоскость"
                        };
                    }
                    return null;
                }, tryBelongs = s => {
                    let m = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*∈\s*(.+)$/);
                    if (!m) return null;
                    const name = m[1], parts = m[2].split("∩").map(x => x.trim()).filter(Boolean);
                    if (1 === parts.length) {
                        const circleToken = parts[0].trim();
                        if (this.namedCircles && this.namedCircles[circleToken]) {
                            const c = this.namedCircles[circleToken], offset = new THREE.Vector3(0, 0, c.radius), pos = c.center.clone().add(offset);
                            return setOrUpdateNamedPoint(name, pos, 16763904), this.pointPlacements[name] = {
                                type: "circle",
                                circle: circleToken,
                                centerName: null
                            }, "sphere" === this.currentFigureType ? (this.pointPlacements[name].centerName = "O", 
                            this.pointPlacements[name].onSurface = !0) : "cone" === this.currentFigureType ? this.pointPlacements[name].centerName = "O" : "cylinder" === this.currentFigureType && (this.pointPlacements[name].centerName = "a" === circleToken ? "O" : "O_1"), 
                            this.createOverlayCircle(c.center, c.normal, c.radius, "#1e90ff"), {
                                ok: !0
                            };
                        }
                        const pair = this._parseEdgeSpec(parts[0]);
                        if (!pair) return {
                            ok: !1,
                            hint: "Не удалось распознать линию"
                        };
                        const A = this.getPointByName(pair[0]), B = this.getPointByName(pair[1]);
                        if (!A || !B) return {
                            ok: !1,
                            hint: "Точки прямой не найдены"
                        };
                        this._autoDrawSegmentIfNew(pair[0], pair[1], !1);
                        const existingPlacement = this.pointPlacements[name];
                        let newPos;
                        if (existingPlacement && "edge" === existingPlacement.type) {
                            const [prevA, prevB] = existingPlacement.points;
                            if (prevA === pair[0] && prevB === pair[1] || prevA === pair[1] && prevB === pair[0]) return this.createOverlayLineSegment(A, B, "#00aa00", !0), 
                            {
                                ok: !0
                            };
                            {
                                const ratio = this.pointRatioConstraints && this.pointRatioConstraints[name];
                                if (ratio && ratio.p > 0 && ratio.q > 0) {
                                    const targetP = ratio.p, targetQ = ratio.q;
                                    let bestT = .5, bestErr = 1 / 0;
                                    const steps = 200;
                                    for (let i = 0; i <= steps; i++) {
                                        const t = i / steps, cand = A.clone().multiplyScalar(1 - t).add(B.clone().multiplyScalar(t)), dA = cand.distanceTo(this.getPointByName(ratio.A)), dB = cand.distanceTo(this.getPointByName(ratio.B)), err = Math.abs(dA * targetQ - dB * targetP);
                                        err < bestErr && (bestErr = err, bestT = t);
                                    }
                                    newPos = A.clone().multiplyScalar(1 - bestT).add(B.clone().multiplyScalar(bestT));
                                } else {
                                    const existingPoint = this.getPointByName(name);
                                    if (existingPoint) {
                                        const prevAPoint = this.getPointByName(prevA), prevBPoint = this.getPointByName(prevB);
                                        if (prevAPoint && prevBPoint) {
                                            const oldEdge = prevBPoint.clone().sub(prevAPoint), tOld = existingPoint.clone().sub(prevAPoint).dot(oldEdge) / oldEdge.lengthSq(), clampedT = Math.max(0, Math.min(1, tOld));
                                            newPos = A.clone().add(B.clone().sub(A).multiplyScalar(clampedT));
                                        } else newPos = (new THREE.Vector3).addVectors(A, B).multiplyScalar(.5);
                                    } else newPos = (new THREE.Vector3).addVectors(A, B).multiplyScalar(.5);
                                }
                                setOrUpdateNamedPoint(name, newPos, 16763904);
                            }
                        } else newPos = (new THREE.Vector3).addVectors(A, B).multiplyScalar(.5), setOrUpdateNamedPoint(name, newPos, 16763904);
                        return this.pointPlacements[name] = {
                            type: "edge",
                            points: [ pair[0], pair[1] ]
                        }, this.createOverlayLineSegment(A, B, "#00aa00", !0), {
                            ok: !0
                        };
                    }
                    if (2 === parts.length) {
                        const p1 = this._parseEdgeSpec(parts[0]), p2 = this._parseEdgeSpec(parts[1]);
                        if (!p1 || !p2) return {
                            ok: !1,
                            hint: "Неверный формат прямых"
                        };
                        const A = this.getPointByName(p1[0]), B = this.getPointByName(p1[1]), C = this.getPointByName(p2[0]), D = this.getPointByName(p2[1]);
                        if (!(A && B && C && D)) return {
                            ok: !1,
                            hint: "Точки прямых не найдены"
                        };
                        this._autoDrawSegmentIfNew(p1[0], p1[1], !1), this._autoDrawSegmentIfNew(p2[0], p2[1], !1);
                        const inter = this._intersectLines3D(A, B, C, D);
                        return inter.ok ? (setOrUpdateNamedPoint(name, inter.point, 16763904), this.pointPlacements[name] = {
                            type: "intersection",
                            edges: [ p1, p2 ]
                        }, this.createOverlayLineSegment(A, B, "#00aa00", !0), this.createOverlayLineSegment(C, D, "#00aa00", !0), 
                        {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Прямые не пересекаются"
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Неверный формат принадлежности"
                    };
                }, setOrUpdateNamedPoint = (name, pos, color = 16763904) => {
                    const marker = this.namedPointMarkers[name];
                    if (marker) {
                        if (marker.position.copy(pos), this.namedPoints[name] = pos.clone(), this.namedPointLabels[name]) {
                            const direction = this._getLabelDirection(pos);
                            this.namedPointLabels[name].position.copy(pos).add(direction.multiplyScalar(.35));
                        }
                        return this.instructionOverlays.includes(marker) || this.instructionOverlays.push(marker), 
                        void (this.namedPointLabels[name] && !this.instructionOverlays.includes(this.namedPointLabels[name]) && this.instructionOverlays.push(this.namedPointLabels[name]));
                    }
                    this.addNamedPointMarker(name, pos, color);
                }, tryRatioDivision = s => {
                    const m = s.replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)[/:]([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)=([0-9]+(?:\.[0-9]+)?)[/:]([0-9]+(?:\.[0-9]+)?)$/);
                    if (!m) return null;
                    const seg1 = [ m[1], m[2] ], seg2 = [ m[3], m[4] ], p = parseFloat(m[5]), q = parseFloat(m[6]);
                    if (!(p > 0 && q > 0)) return {
                        ok: !1,
                        hint: "Неверные числа отношения"
                    };
                    const inter = [ ...new Set(seg1) ].filter(n => seg2.includes(n));
                    if (1 !== inter.length) return {
                        ok: !1,
                        hint: "несогл точки в отношении"
                    };
                    const Nname = inter[0], Aname = seg1[0] === Nname ? seg1[1] : seg1[0], Bname = seg2[0] === Nname ? seg2[1] : seg2[0], A = this.getPointByName(Aname), B = this.getPointByName(Bname);
                    if (!A || !B) return {
                        ok: !1,
                        hint: "Точки отрезков не найдены"
                    };
                    this._autoDrawSegmentIfNew(Aname, Nname, !1), this._autoDrawSegmentIfNew(Nname, Bname, !1);
                    let edgeNames = null;
                    const placement = this.pointPlacements[Nname];
                    edgeNames = placement && "edge" === placement.type && Array.isArray(placement.points) ? placement.points.slice() : [ Aname, Bname ];
                    let Npos = null;
                    if (edgeNames[0] === Aname && edgeNames[1] === Bname || edgeNames[0] === Bname && edgeNames[1] === Aname || this._normalizeName(edgeNames[0]) === this._normalizeName(Aname) && this._normalizeName(edgeNames[1]) === this._normalizeName(Bname) || this._normalizeName(edgeNames[0]) === this._normalizeName(Bname) && this._normalizeName(edgeNames[1]) === this._normalizeName(Aname)) Npos = A.clone().multiplyScalar(q / (p + q)).add(B.clone().multiplyScalar(p / (p + q))); else {
                        const P1 = this.getPointByName(edgeNames[0]), P2 = this.getPointByName(edgeNames[1]);
                        if (P1 && P2) {
                            const targetP = p, targetQ = q;
                            let bestT = .5, bestErr = 1 / 0;
                            const steps = 500;
                            for (let i = 0; i <= steps; i++) {
                                const t = i / steps, cand = P1.clone().multiplyScalar(1 - t).add(P2.clone().multiplyScalar(t)), dA = cand.distanceTo(A), dB = cand.distanceTo(B), err = Math.abs(dA * targetQ - dB * targetP);
                                err < bestErr && (bestErr = err, bestT = t);
                            }
                            Npos = P1.clone().multiplyScalar(1 - bestT).add(P2.clone().multiplyScalar(bestT));
                        } else {
                            const denom = p + q;
                            Npos = A.clone().multiplyScalar(q / denom).add(B.clone().multiplyScalar(p / denom)), 
                            edgeNames = [ Aname, Bname ];
                        }
                    }
                    return setOrUpdateNamedPoint(Nname, Npos, 16763904), this.pointPlacements[Nname] = {
                        type: "edge",
                        points: [ edgeNames[0], edgeNames[1] ]
                    }, this.pointRatioConstraints[Nname] = {
                        A: Aname,
                        B: Bname,
                        p: p,
                        q: q
                    }, this.pointEdgeBary[Nname] = {
                        A: Aname,
                        B: Bname,
                        t: p / (p + q)
                    }, this.createOverlayLineSegment(A, B, "#00aa00", !0), {
                        ok: !0
                    };
                }, tryMedianBisectorAltitude = s => {
                    const m2 = s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(Медиана|мед|Биссектриса|Биссеткриса|бис|Высота|выс|Перпендикуляр|перпенд|перп)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i), m1 = !m2 && s.match(/^\s*([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)\s*=\s*(Биссектриса|Биссеткриса|бис)\s*\(([^\)]*)\)\s*$/i), buildAngleBisector = (name, angleExpr) => {
                        const t = String(angleExpr || "").trim();
                        let am = t.match(/^\s*(?:Угол|∠)\s*\(([^,]+)\s*,\s*([^\)]+)\)\s*$/i);
                        if (am) {
                            const e1 = am[1].trim(), e2 = am[2].trim(), pl1 = this._parseLineExpr(e1), pr1 = this._parseRayExpr(e1), ps1 = this._parseSegmentExpr(e1), pl2 = this._parseLineExpr(e2), pr2 = this._parseRayExpr(e2), ps2 = this._parseSegmentExpr(e2), L1 = this._getLineFromAnyLinelikeResult(pl1, pr1, ps1), L2 = this._getLineFromAnyLinelikeResult(pl2, pr2, ps2);
                            if (!L1 || !L2) return {
                                ok: !1,
                                hint: "Не распознаны объекты угла"
                            };
                            const inter = this._intersectLines3D(L1.point, L1.point.clone().add(L1.dir), L2.point, L2.point.clone().add(L2.dir));
                            if (!inter.ok) return {
                                ok: !1,
                                hint: "Прямые не пересекаются - биссектриса не определена"
                            };
                            const d1 = L1.dir.clone().normalize(), d2 = L2.dir.clone().normalize(), bis = d1.clone().add(d2);
                            if (!(bis.length() > 1e-12)) return {
                                ok: !1,
                                hint: "направления противоположны"
                            };
                            const line = {
                                point: inter.point.clone(),
                                dir: bis.normalize()
                            };
                            this.namedLines[name] = line, this.createOverlayInfiniteLine(L1.point, L1.dir, "#00aa88"), 
                            this.createOverlayInfiniteLine(L2.point, L2.dir, "#00aa88"), this.createOverlayInfiniteLine(line.point, line.dir, "#ff8c00");
                            try {
                                const markR = .8 * this._estimateOverlayScale(.25);
                                this.createAngleArc(inter.point, L1.dir, line.dir, .6 * markR, 52377), this.createAngleArc(inter.point, line.dir, L2.dir, .6 * markR, 16737996);
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        if (am = t.replace(/\s+/g, "").match(/^∠([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/), 
                        am) {
                            const A = this.getPointByName(am[1]), B = this.getPointByName(am[2]), C = this.getPointByName(am[3]);
                            if (!A || !B || !C) return {
                                ok: !1,
                                hint: "Точки угла не найдены"
                            };
                            const basis = this._buildPlaneBasisFromPoints([ A, B, C ]);
                            if (!basis.ok) return {
                                ok: !1,
                                hint: "Точки угла коллинеарны"
                            };
                            const dir3 = this._computeBisectorDir3D(A, B, C, basis);
                            if (!dir3) return {
                                ok: !1,
                                hint: "точки совпад."
                            };
                            const line = {
                                point: B.clone(),
                                dir: dir3
                            };
                            this.namedLines[name] = line, this.createOverlayInfiniteLine({
                                point: B,
                                dir: A.clone().sub(B).normalize()
                            }.point || B, A.clone().sub(B), "#00aa88"), this.createOverlayInfiniteLine({
                                point: B,
                                dir: C.clone().sub(B).normalize()
                            }.point || B, C.clone().sub(B), "#00aa88"), this.createOverlayInfiniteLine(line.point, line.dir, "#ff8c00");
                            try {
                                const markR = .8 * this._estimateOverlayScale(.25), dBA = A.clone().sub(B).normalize(), dBC = C.clone().sub(B).normalize();
                                this.createAngleArc(B, dBA, line.dir, .6 * markR, 52377), this.createAngleArc(B, line.dir, dBC, .6 * markR, 16737996);
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        if (am = t.match(/^\s*(?:Угол|∠)\s*\(([^,]+)\s*,\s*([^,]+)\s*,\s*([^\)]+)\)\s*$/i), 
                        am) {
                            const A = this._parsePointToken(am[1]), B = this._parsePointToken(am[2]), C = this._parsePointToken(am[3]);
                            if (!A || !B || !C) return {
                                ok: !1,
                                hint: "Точки угла не найдены"
                            };
                            const basis = this._buildPlaneBasisFromPoints([ A, B, C ]);
                            if (!basis.ok) return {
                                ok: !1,
                                hint: "Точки угла коллинеарны"
                            };
                            const dir3 = this._computeBisectorDir3D(A, B, C, basis);
                            if (!dir3) return {
                                ok: !1,
                                hint: "точки совпад."
                            };
                            const line = {
                                point: B.clone(),
                                dir: dir3
                            };
                            this.namedLines[name] = line, this.createOverlayInfiniteLine(B, A.clone().sub(B), "#00aa88"), 
                            this.createOverlayInfiniteLine(B, C.clone().sub(B), "#00aa88"), this.createOverlayInfiniteLine(line.point, line.dir, "#ff8c00");
                            try {
                                const markR = .8 * this._estimateOverlayScale(.25), dBA = A.clone().sub(B).normalize(), dBC = C.clone().sub(B).normalize();
                                this.createAngleArc(B, dBA, line.dir, .6 * markR, 52377), this.createAngleArc(B, line.dir, dBC, .6 * markR, 16737996);
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        return {
                            ok: !1,
                            hint: "Ожидался угол: ∠ABC, Угол(A,B,C) или ∠(obj1, obj2)"
                        };
                    };
                    if (!m2 && m1) return buildAngleBisector(m1[1], m1[3]);
                    if (!m2) return null;
                    const name = m2[1], kindRaw = m2[2].toLowerCase(), sourcePointToken = m2[3].trim(), P = this._parsePointToken(sourcePointToken), targ = m2[4].trim();
                    if (!P) return {
                        ok: !1,
                        hint: "Первая точка не распознана"
                    };
                    let kind = kindRaw;
                    "биссеткриса" === kind && (kind = "биссектриса"), "перпендикуляр" !== kind && "перпенд" !== kind && "перп" !== kind || (kind = "высота");
                    const extractedFootName = this._extractFootNameFromConstructName(name, sourcePointToken), pts = _parsePointList(targ), isPolygon = pts && pts.length >= 3, ensurePolygonWithVertex = () => {
                        if (!isPolygon) return {
                            ok: !1
                        };
                        if (!this._isPlanar(pts)) return {
                            ok: !1,
                            hint: "Точки фигуры не копланарны"
                        };
                        const idx = pts.findIndex(q => q && q.distanceTo(P) < 1e-6);
                        return idx < 0 ? {
                            ok: !1,
                            hint: "Точка не является вершиной многоугольника"
                        } : {
                            ok: !0,
                            idx: idx
                        };
                    };
                    if ("медиана" === kind || "мед" === kind) {
                        const chk = ensurePolygonWithVertex();
                        if (!chk.ok) return chk;
                        if (3 !== pts.length) return {
                            ok: !1,
                            hint: "Медиана поддерживается только для треугольника"
                        };
                        const i = chk.idx, opp1 = (pts[i], pts[(i + 1) % 3]), opp2 = pts[(i + 2) % 3], M = opp1.clone().add(opp2).multiplyScalar(.5), line = this._lineFromTwoPoints(P, M);
                        return this.namedLines[name] = line, this.namedSegments[name] = {
                            a: P.clone(),
                            b: M.clone()
                        }, this._addFootPointIfNew(M, extractedFootName, 16763904), this.createOverlayLineSegment(opp1, opp2, "#1e90ff"), 
                        this.createOverlayLineSegment(P, M, "#ff1493"), {
                            ok: !0
                        };
                    }
                    if ("высота" === kind || "выс" === kind) {
                        const chk = ensurePolygonWithVertex();
                        if (chk.ok) {
                            if (3 !== pts.length) return {
                                ok: !1,
                                hint: "Высота многоугольника поддерживается только для треугольника"
                            };
                            const i = chk.idx, B = (pts[i], pts[(i + 1) % 3]), C = pts[(i + 2) % 3], oppLine = this._lineFromTwoPoints(B, C), pr = this._projectPointOnLine(P, oppLine);
                            if (!pr.ok) return {
                                ok: !1,
                                hint: "Не удалось опустить высоту"
                            };
                            const line = this._lineFromTwoPoints(P, pr.point);
                            this.namedLines[name] = line, this.namedSegments[name] = {
                                a: P.clone(),
                                b: pr.point.clone()
                            }, this._addFootPointIfNew(pr.point, extractedFootName, 16763904), this.createOverlayLineSegment(B, C, "#1e90ff"), 
                            this.createOverlayLineSegment(P, pr.point, "#8a2be2");
                            try {
                                const markSize = .5 * this._estimateOverlayScale(.25);
                                this.createRightAngleMark(pr.point, line.dir, oppLine.dir, markSize, "#8a2be2");
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        const l2 = this._parseLineExpr(targ);
                        if (l2.ok) {
                            const pr = this._projectPointOnLine(P, l2.line);
                            if (!pr.ok) return {
                                ok: !1,
                                hint: "Проекция не вычислена"
                            };
                            const v = pr.point.clone().sub(P);
                            if (!(v.length() > 1e-9)) return {
                                ok: !1,
                                hint: "Точка лежит на прямой"
                            };
                            const line = {
                                point: P.clone(),
                                dir: v.clone().normalize()
                            };
                            this.namedLines[name] = line, this.namedSegments[name] = {
                                a: P.clone(),
                                b: pr.point.clone()
                            }, this._addFootPointIfNew(pr.point, extractedFootName, 16763904), this.createOverlayInfiniteLine(line.point, line.dir, "#8a2be2"), 
                            this.createOverlayInfiniteLine(l2.line.point, l2.line.dir, "#00aa88");
                            try {
                                const markSize = .5 * this._estimateOverlayScale(.25);
                                this.createRightAngleMark(pr.point, line.dir, l2.line.dir, markSize, "#8a2be2");
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        const p2 = this._parsePlaneExpr(targ);
                        if (p2.ok) {
                            const line = {
                                point: P.clone(),
                                dir: p2.plane.normal.clone().normalize()
                            };
                            this.namedLines[name] = line;
                            const pr = this._projectPointOnPlane(P, p2.plane);
                            pr.ok && (this.createOverlayLineSegment(P, pr.point, "#8a2be2"), this.namedSegments[name] = {
                                a: P.clone(),
                                b: pr.point.clone()
                            }, this._addFootPointIfNew(pr.point, extractedFootName, 16763904)), this.createOverlayInfiniteLine(line.point, line.dir, "#8a2be2"), 
                            this.createOverlayPlane(p2.plane.point, p2.plane.normal, 3, 2003199, .08);
                            try {
                                if (pr.ok) {
                                    const n = p2.plane.normal.clone().normalize(), arbitrary = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), t1 = (new THREE.Vector3).crossVectors(n, arbitrary).normalize(), markSize = ((new THREE.Vector3).crossVectors(n, t1).normalize(), 
                                    .5 * this._estimateOverlayScale(.25));
                                    this.createRightAngleMark(pr.point, t1, line.dir, markSize, "#8a2be2");
                                }
                            } catch (_) {}
                            return {
                                ok: !0
                            };
                        }
                        return {
                            ok: !1,
                            hint: "не распознана как прямая, плоскость или треугольник с данной вершиной"
                        };
                    }
                    if ("биссектриса" === kind || "бис" === kind) {
                        if (/^\s*(Угол|∠)\s*\(/i.test(targ) || /^\s*∠/i.test(targ)) return {
                            ok: !1,
                            hint: "для угла используйте один аргумент: Биссектриса(∠ABC) или Биссектриса(Угол(...))"
                        };
                        const chk = ensurePolygonWithVertex();
                        if (!chk.ok) return chk;
                        const basis = this._buildPlaneBasisFromPoints(pts);
                        if (!basis.ok) return {
                            ok: !1,
                            hint: "Точки не копланарны"
                        };
                        const p2 = this._projectPointsTo2D(pts, basis.origin, basis.e1, basis.e2), i = chk.idx, prev2 = p2[(i - 1 + p2.length) % p2.length], cur2 = p2[i], next2 = p2[(i + 1) % p2.length], u = this._normalized2DDir(cur2, prev2), v = this._normalized2DDir(cur2, next2), d = {
                            x: u.x + v.x,
                            y: u.y + v.y
                        }, Ld = Math.hypot(d.x, d.y);
                        if (!(Ld > 1e-12)) return {
                            ok: !1,
                            hint: "совпадают точки"
                        };
                        const dir3 = basis.e1.clone().multiplyScalar(d.x / Ld).add(basis.e2.clone().multiplyScalar(d.y / Ld)).normalize(), line = {
                            point: P.clone(),
                            dir: dir3
                        };
                        this.namedLines[name] = line;
                        const n = pts.length;
                        for (let k = 0; k < n; k++) this.createOverlayLineSegment(pts[k], pts[(k + 1) % n], "#1e90ff");
                        this.createOverlayInfiniteLine(line.point, line.dir, "#ff8c00");
                        try {
                            const markR = .8 * this._estimateOverlayScale(.25), ePrev = pts[(i - 1 + n) % n].clone().sub(P).normalize(), eNext = pts[(i + 1) % n].clone().sub(P).normalize();
                            this.createAngleArc(P, ePrev, line.dir, .6 * markR, 52377), this.createAngleArc(P, line.dir, eNext, .6 * markR, 16737996);
                        } catch (_) {}
                        try {
                            const r = {
                                x: d.x / Ld,
                                y: d.y / Ld
                            }, pc = {
                                x: cur2.x,
                                y: cur2.y
                            }, cross2 = (a, b) => a.x * b.y - a.y * b.x;
                            let bestT = 1 / 0, hit = null;
                            for (let k = 0; k < n; k++) {
                                if (k === i || (k + 1) % n === i) continue;
                                const a = p2[k], b = p2[(k + 1) % n], s = {
                                    x: b.x - a.x,
                                    y: b.y - a.y
                                }, denom = cross2({
                                    x: r.x,
                                    y: r.y
                                }, s);
                                if (Math.abs(denom) < 1e-12) continue;
                                const ap = {
                                    x: a.x - pc.x,
                                    y: a.y - pc.y
                                }, t = cross2(ap, s) / denom, upar = cross2(ap, {
                                    x: r.x,
                                    y: r.y
                                }) / denom;
                                t > 1e-9 && upar > -1e-9 && upar < 1 + 1e-9 && t < bestT && (bestT = t, hit = {
                                    x: pc.x + r.x * t,
                                    y: pc.y + r.y * t
                                });
                            }
                            if (hit) {
                                const X = basis.origin.clone().add(basis.e1.clone().multiplyScalar(hit.x)).add(basis.e2.clone().multiplyScalar(hit.y));
                                this.namedSegments[name] = {
                                    a: P.clone(),
                                    b: X.clone()
                                }, this._addFootPointIfNew(X, extractedFootName, 16763904);
                            }
                        } catch (_) {}
                        return {
                            ok: !0
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Биссектриса: Фигура - Биссектриса(P, ABC). Угол - Биссектриса(∠ABC) или Биссектриса(Угол(AB, BC)/∠(AB, BC))"
                    };
                }, tryRelation = s => {
                    const opMatch = s.match(/(∥|⟂)/);
                    if (!opMatch) return null;
                    const rel = opMatch[1], parts = s.split(rel);
                    if (2 !== parts.length) return {
                        ok: !1,
                        hint: "Неверный формат отношения"
                    };
                    const left = parts[0], right = parts[1], l = this._parseEdgeSpec(left), r = this._parseEdgeSpec(right);
                    if (l && r) {
                        const A = this.getPointByName(l[0]), B = this.getPointByName(l[1]), C = this.getPointByName(r[0]), D = this.getPointByName(r[1]);
                        if (!(A && B && C && D)) return {
                            ok: !1,
                            hint: "Точки отрезков не найдены"
                        };
                        this._autoDrawSegmentIfNew(l[0], l[1], !1), this._autoDrawSegmentIfNew(r[0], r[1], !1);
                        const v1 = (new THREE.Vector3).subVectors(B, A), v2 = (new THREE.Vector3).subVectors(D, C);
                        if (!(v1.length() > 1e-9 && v2.length() > 1e-9)) return {
                            ok: !1,
                            hint: "Нулевой отрезок"
                        };
                        const cross = (new THREE.Vector3).crossVectors(v1, v2).length(), dot = v1.clone().normalize().dot(v2.clone().normalize());
                        if ("∥" === rel) {
                            if (!(cross / (v1.length() * v2.length()) < .001)) return {
                                ok: !1,
                                hint: "Не параллельны"
                            };
                        } else if (!(Math.abs(dot) < .001)) return {
                            ok: !1,
                            hint: "Не перпендикулярны"
                        };
                        return this.createOverlayLineSegment(A, B, "#1e90ff"), this.createOverlayLineSegment(C, D, "#1e90ff"), 
                        {
                            ok: !0
                        };
                    }
                    const unknownMatch = left.replace(/\s+/g, "").match(/^([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)([A-Za-zΑ-Ωα-ωА-Яа-я][\w\u0370-\u03FF\u0400-\u04FF]*)$/), rightEdge = right.trim();
                    if ("∥" === rel && unknownMatch) {
                        const Nname = unknownMatch[1], Kname = unknownMatch[2], N = this.getPointByName(Nname);
                        if (!N) return {
                            ok: !1,
                            hint: "Точка N не найдена"
                        };
                        let dir = null;
                        const fromEdge = this._lineFromEdgeLabel(rightEdge);
                        if (fromEdge.ok && (dir = fromEdge.line.dir.clone()), !dir && this.namedLines[rightEdge] && (dir = this.namedLines[rightEdge].dir.clone()), 
                        !dir) return {
                            ok: !1,
                            hint: "Не распознано направление"
                        };
                        const found = this._findKForParallelThroughN(N, dir);
                        return found.ok ? (this.addNamedPointMarker(Kname, found.point, 16763904), this.createOverlayInfiniteLine(found.line.point, found.line.dir, "#1e90ff"), 
                        {
                            ok: !0
                        }) : {
                            ok: !1,
                            hint: "Нет подходящего пересечения для K"
                        };
                    }
                    return {
                        ok: !1,
                        hint: "Не удалось распознать отрезки"
                    };
                }, queriesPass = [];
                lines.forEach(raw => {
                    const s = raw.trim();
                    if (!s) return;
                    let r;
                    r = tryRatioDivision(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryDistanceQuery(s), 
                    null === r ? (r = tryLengthQuery(s), null === r ? (r = tryGeneratrixQuery(s), null === r ? (r = tryDiameterRadiusQuery(s), 
                    null === r ? (r = tryAreaQuery(s), null === r ? (r = tryPerimeterQuery(s), null === r ? (r = tryVolumeQuery(s), 
                    null === r ? (r = tryCenterDefinition(s), null === r ? (r = tryVariableDefinition(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryPointDefinition(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryVectorDefinition(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryLineRaySegPlaneDefinition(s), 
                    null === r ? (r = tryMidpointDivision(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryPolyline(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = trySection(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryInscribeCircumscribe2D(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryInscribeCircumscribe3D(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryColCoplanar(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryProjections(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryIntersections(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryMedianBisectorAltitude(s), r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryConstraintConstruct(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryPredicatesAndAngles(s), null === r ? (r = tryBelongs(s), 
                    r ? makeLine(raw, !!r.ok, r.hint || "") : (r = tryRelation(s), r ? makeLine(raw, !!r.ok, r.hint || "") : makeLine(raw, !1, "Не удалось интерпретировать строку"))) : queriesPass.push({
                        raw: raw,
                        handler: tryPredicatesAndAngles
                    })))))))))))) : queriesPass.push({
                        raw: raw,
                        handler: tryLineRaySegPlaneDefinition
                    }))))) : queriesPass.push({
                        raw: raw,
                        handler: tryCenterDefinition
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryVolumeQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryPerimeterQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryAreaQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryDiameterRadiusQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryGeneratrixQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryLengthQuery
                    })) : queriesPass.push({
                        raw: raw,
                        handler: tryDistanceQuery
                    }));
                }), queriesPass.forEach(({raw: raw, handler: handler}) => {
                    const r = handler(raw.trim());
                    r ? makeLine(raw, !!r.ok, r.hint || "", r.value || "") : makeLine(raw, !1, "Не удалось обработать запрос");
                });
            } finally {
                this._isParsingInstructions = !1;
            }
        }
    }
    _intersectLines3D(A, B, C, D) {
        const p1 = A.clone(), d1 = B.clone().sub(A), p2 = C.clone(), d2 = D.clone().sub(C), a = d1.dot(d1), b = d1.dot(d2), c = d2.dot(d2), w0 = p1.clone().sub(p2), d = d1.dot(w0), e = d2.dot(w0), denom = a * c - b * b;
        let t, u;
        Math.abs(denom) < 1e-9 ? (t = 0, u = e / (c || 1)) : (t = (b * e - c * d) / denom, 
        u = (a * e - b * d) / denom);
        const pOn1 = p1.clone().add(d1.clone().multiplyScalar(t)), pOn2 = p2.clone().add(d2.clone().multiplyScalar(u));
        return pOn1.distanceTo(pOn2) > .001 ? {
            ok: !1
        } : {
            ok: !0,
            point: pOn1.add(pOn2).multiplyScalar(.5),
            t: t,
            u: u
        };
    }
    _lineFromTwoPoints(A, B) {
        return {
            point: A.clone(),
            dir: B.clone().sub(A)
        };
    }
    _rayFromTwoPoints(A, B) {
        return {
            origin: A.clone(),
            dir: B.clone().sub(A)
        };
    }
    _segmentFromTwoPoints(A, B) {
        return {
            a: A.clone(),
            b: B.clone()
        };
    }
    _getLineFromAnyLinelikeResult(resultL, resultR, resultS) {
        return resultL.ok ? resultL.line : resultR.ok ? {
            point: resultR.ray.origin.clone(),
            dir: resultR.ray.dir.clone()
        } : resultS.ok ? this._lineFromTwoPoints(resultS.segment.a, resultS.segment.b) : null;
    }
    _isPlanar(pts) {
        if (pts.length < 3) return !1;
        const n = (new THREE.Vector3).crossVectors(pts[1].clone().sub(pts[0]), pts[2].clone().sub(pts[0]));
        for (let i = 3; i < pts.length; i++) if (Math.abs((new THREE.Matrix3).set(pts[1].x - pts[0].x, pts[1].y - pts[0].y, pts[1].z - pts[0].z, pts[2].x - pts[0].x, pts[2].y - pts[0].y, pts[2].z - pts[0].z, pts[i].x - pts[0].x, pts[i].y - pts[0].y, pts[i].z - pts[0].z).determinant()) > 1e-6) return !1;
        return n.length() > 1e-9;
    }
    _normalized2DDir(from, to) {
        const vx = to.x - from.x, vy = to.y - from.y, L = Math.hypot(vx, vy);
        return L > 0 ? {
            x: vx / L,
            y: vy / L
        } : {
            x: 0,
            y: 0
        };
    }
    _computeBisectorDir3D(A, B, C, basis) {
        const p2 = this._projectPointsTo2D([ A, B, C ], basis.origin, basis.e1, basis.e2), prev = p2[0], cur = p2[1], next = p2[2], u = this._normalized2DDir(cur, prev), v = this._normalized2DDir(cur, next), d = {
            x: u.x + v.x,
            y: u.y + v.y
        }, L = Math.hypot(d.x, d.y);
        return L > 1e-12 ? basis.e1.clone().multiplyScalar(d.x / L).add(basis.e2.clone().multiplyScalar(d.y / L)).normalize() : null;
    }
    _getBBoxDimensions(bbox) {
        return {
            r: (bbox.max.x - bbox.min.x) / 2,
            h: bbox.max.y - bbox.min.y,
            centerBottom: new THREE.Vector3(0, 0, 0),
            centerTop: new THREE.Vector3(0, bbox.max.y - bbox.min.y, 0),
            center: new THREE.Vector3(0, (bbox.max.x - bbox.min.x) / 2, 0)
        };
    }
    _autoDrawSegmentIfNew(nameA, nameB, isSegment = !0) {
        const key = [ nameA, nameB ].sort().join("-");
        if (this.autoDrawnSegments.has(key)) return;
        this.autoDrawnSegments.add(key);
        const P1 = this.getPointByName(nameA), P2 = this.getPointByName(nameB);
        P1 && P2 && this.createOverlayLineSegment(P1, P2, "#888888", !1);
    }
    _extractFootNameFromConstructName(constructName, sourcePointName) {
        const normalized = this._normalizeName(constructName || ""), sourceNorm = this._normalizeName(sourcePointName || ""), m = normalized.match(/^([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)$/);
        if (m) {
            const first = m[1], second = m[2];
            if (this._normalizeName(first) === sourceNorm) return second;
            if (this._normalizeName(second) === sourceNorm) return first;
        }
        return null;
    }
    _addFootPointIfNew(position, footName = null, color = 16763904) {
        const eps = 1e-6;
        if (this.vertices && this.vertexLabels) for (let i = 0; i < this.vertices.length; i++) if (this.vertices[i] && this.vertices[i].distanceTo(position) < eps) return;
        if (this.namedPoints) for (const name in this.namedPoints) if (this.namedPoints[name] && this.namedPoints[name].distanceTo(position) < eps) return;
        if (this.sections && Array.isArray(this.sections)) for (const section of this.sections) if (section && Array.isArray(section.points)) for (const pt of section.points) if (pt && pt.distanceTo(position) < eps) return;
        const name = footName || this.generateSectionPointLabel();
        this.addNamedPointMarker(name, position, color);
    }
    _extractThreePointNames(arg) {
        const cm = arg.match(/^([A-Za-zА-Яа-я](?:_\d+)?)\s*,\s*([A-Za-zА-Яа-я](?:_\d+)?)\s*,\s*([A-Za-zА-Яа-я](?:_\d+)?)$/);
        if (cm) return [ cm[1], cm[2], cm[3] ];
        const mm = arg.replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/);
        return mm ? [ mm[1], mm[2], mm[3] ] : null;
    }
    _getThreePoints(names) {
        const points = names.map(n => this.getPointByName(n)), missing = names.filter((n, i) => !points[i]);
        return missing.length ? {
            ok: !1,
            hint: `Точки не найдены: ${missing.join(", ")}`,
            points: null
        } : {
            ok: !0,
            points: points
        };
    }
    _extractTwoPointNames(arg) {
        const cm = arg.match(/^([A-Za-zА-Яа-я](?:_\d+)?)\s*,\s*([A-Za-zА-Яа-я](?:_\d+)?)$/);
        if (cm) return [ cm[1], cm[2] ];
        const mm = arg.replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/);
        return mm ? [ mm[1], mm[2] ] : null;
    }
    _getTwoPoints(names) {
        const [A, B] = names.map(n => this.getPointByName(n));
        return A && B ? {
            ok: !0,
            points: [ A, B ]
        } : {
            ok: !1,
            hint: "Точки не найдены",
            points: null
        };
    }
    _planeFromThreePoints(A, B, C) {
        const n = (new THREE.Vector3).crossVectors(B.clone().sub(A), C.clone().sub(A));
        return n.length() < 1e-9 ? {
            ok: !1
        } : {
            ok: !0,
            point: A.clone(),
            normal: n
        };
    }
    _planeFromPointNormal(P, n) {
        const nn = n.clone();
        return nn.length() < 1e-9 ? {
            ok: !1
        } : {
            ok: !0,
            point: P.clone(),
            normal: nn
        };
    }
    _projectPointOnLine(P, line) {
        const v = P.clone().sub(line.point), d = line.dir.clone(), denom = d.lengthSq();
        if (!(denom > 1e-12)) return {
            ok: !1
        };
        const t = v.dot(d) / denom;
        return {
            ok: !0,
            point: line.point.clone().add(d.multiplyScalar(t)),
            t: t
        };
    }
    _projectPointOnPlane(P, plane) {
        const n = plane.normal.clone(), denom = n.lengthSq();
        if (!(denom > 1e-12)) return {
            ok: !1
        };
        const t = n.dot(plane.point.clone().sub(P)) / denom;
        return {
            ok: !0,
            point: P.clone().add(n.multiplyScalar(t))
        };
    }
    _projectVectorOnPlane(v, plane) {
        const n = plane.normal.clone().normalize(), vParallel = v.clone().sub(n.clone().multiplyScalar(v.dot(n)));
        return vParallel.length() <= 1e-9 ? new THREE.Vector3(0, 0, 0) : vParallel;
    }
    _findLinesIntersectionOrClosest(line1, line2) {
        const p1 = line1.point.clone(), d1 = line1.dir.clone().normalize(), p2 = line2.point.clone(), d2 = line2.dir.clone().normalize(), w0 = p1.clone().sub(p2), a = d1.dot(d1), b = d1.dot(d2), c = d2.dot(d2), d = d1.dot(w0), e = d2.dot(w0), denom = a * c - b * b;
        if (Math.abs(denom) < 1e-9) return p1;
        const t1 = (b * e - c * d) / denom;
        return p1.clone().add(d1.multiplyScalar(t1));
    }
    _intersectLinePlane(line, plane) {
        const p0 = line.point.clone(), d = line.dir.clone(), n = plane.normal.clone(), w = p0.clone().sub(plane.point), denom = n.dot(d);
        if (Math.abs(denom) < 1e-9) return {
            ok: !1
        };
        const t = -n.dot(w) / denom;
        return {
            ok: !0,
            point: p0.add(d.multiplyScalar(t)),
            t: t
        };
    }
    _intersectLineWithSegment(line, A, B) {
        const r = this._intersectLines3D(line.point, line.point.clone().add(line.dir), A, B);
        if (!r.ok) return {
            ok: !1
        };
        const AB = B.clone().sub(A), len2 = AB.lengthSq();
        if (!(len2 > 1e-12)) return {
            ok: !1
        };
        const u = r.point.clone().sub(A).dot(AB) / len2;
        return u < -1e-6 || u > 1.000001 ? {
            ok: !1
        } : {
            ok: !0,
            point: r.point,
            u: u
        };
    }
    _intersectLineWithRay(line, origin, dir) {
        const r = this._intersectLines3D(line.point, line.point.clone().add(line.dir), origin, origin.clone().add(dir));
        if (!r.ok) return {
            ok: !1
        };
        const d = dir.clone(), len2 = d.lengthSq();
        return len2 > 1e-12 ? (r.point.clone().sub(origin).dot(d), Math.sqrt(len2), r.point.clone().sub(origin).dot(d) < -1e-9 ? {
            ok: !1
        } : {
            ok: !0,
            point: r.point
        }) : {
            ok: !1
        };
    }
    _lineFromEdgeLabel(edge) {
        const cm = String(edge || "").match(/^\s*([A-Za-zА-Яа-я](?:_\d+)?)\s*,\s*([A-Za-zА-Яа-я](?:_\d+)?)\s*$/);
        if (cm) {
            const A = this.getPointByName(cm[1]), B = this.getPointByName(cm[2]);
            return A && B ? {
                ok: !0,
                line: this._lineFromTwoPoints(A, B)
            } : {
                ok: !1
            };
        }
        const mm = String(edge || "").replace(/\s+/g, "").match(/^([A-Za-zА-Яа-я](?:_\d+)?)([A-Za-zА-Яа-я](?:_\d+)?)$/);
        if (!mm) return {
            ok: !1
        };
        const A = this.getPointByName(mm[1]), B = this.getPointByName(mm[2]);
        return A && B ? {
            ok: !0,
            line: this._lineFromTwoPoints(A, B)
        } : {
            ok: !1
        };
    }
    _findKForParallelThroughN(N, parallelDir) {
        const lineN = {
            point: N.clone(),
            dir: parallelDir.clone()
        }, candidates = [];
        this.getFigureEdges().forEach(([a, b]) => {
            const r = this._intersectLineWithSegment(lineN, a, b);
            r.ok && candidates.push({
                P: r.point,
                src: "edge"
            });
        }), Object.values(this.namedSegments || {}).forEach(seg => {
            const r = this._intersectLineWithSegment(lineN, seg.a, seg.b);
            r.ok && candidates.push({
                P: r.point,
                src: "segment"
            });
        }), Object.values(this.namedRays || {}).forEach(ray => {
            const r = this._intersectLineWithRay(lineN, ray.origin, ray.dir);
            r.ok && candidates.push({
                P: r.point,
                src: "ray"
            });
        }), Object.values(this.namedLines || {}).forEach(l => {
            const r = this._intersectLines3D(lineN.point, lineN.point.clone().add(lineN.dir), l.point, l.point.clone().add(l.dir));
            r.ok && candidates.push({
                P: r.point,
                src: "line"
            });
        });
        let best = null, bestD = 1 / 0;
        return candidates.forEach(c => {
            const d = c.P.distanceTo(N);
            d > 1e-4 && d < bestD && (bestD = d, best = c);
        }), best ? {
            ok: !0,
            point: best.P,
            line: lineN
        } : {
            ok: !1
        };
    }
    _planeEquation(plane) {
        const n = plane.normal.clone(), p0 = plane.point.clone(), a = n.x, b = n.y, c = n.z;
        return {
            a: a,
            b: b,
            c: c,
            d: -(a * p0.x + b * p0.y + c * p0.z)
        };
    }
    _intersectPlanes(p1, p2) {
        const n1 = p1.normal.clone(), n2 = p2.normal.clone(), u = (new THREE.Vector3).crossVectors(n1, n2), denom = u.lengthSq();
        if (!(denom > 1e-12)) return {
            ok: !1
        };
        const e1 = this._planeEquation(p1), e2 = this._planeEquation(p2);
        return {
            ok: !0,
            line: {
                point: (new THREE.Vector3).crossVectors((new THREE.Vector3).subVectors(n1.clone().multiplyScalar(e2.d), n2.clone().multiplyScalar(e1.d)), u).multiplyScalar(1 / denom),
                dir: u
            }
        };
    }
    _solveThreePlanesPoint(pa, pb, pc) {
        const ea = this._planeEquation(pa), eb = this._planeEquation(pb), ec = this._planeEquation(pc), A = [ [ ea.a, ea.b, ea.c ], [ eb.a, eb.b, eb.c ], [ ec.a, ec.b, ec.c ] ], b = [ -ea.d, -eb.d, -ec.d ], detA = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]), D = detA(A);
        if (Math.abs(D) < 1e-12) return {
            ok: !1
        };
        const Ax = [ [ b[0], A[0][1], A[0][2] ], [ b[1], A[1][1], A[1][2] ], [ b[2], A[2][1], A[2][2] ] ], Ay = [ [ A[0][0], b[0], A[0][2] ], [ A[1][0], b[1], A[1][2] ], [ A[2][0], b[2], A[2][2] ] ], Az = [ [ A[0][0], A[0][1], b[0] ], [ A[1][0], A[1][1], b[1] ], [ A[2][0], A[2][1], b[2] ] ], x = detA(Ax) / D, y = detA(Ay) / D, z = detA(Az) / D;
        return {
            ok: !0,
            point: new THREE.Vector3(x, y, z)
        };
    }
    _distancePointLine(P, line) {
        const v = line.dir.clone(), w = P.clone().sub(line.point);
        return (new THREE.Vector3).crossVectors(w, v).length() / Math.max(1e-12, v.length());
    }
    _distancePointPlane(P, plane) {
        const n = plane.normal.clone();
        return Math.abs(n.dot(P.clone().sub(plane.point))) / Math.max(1e-12, n.length());
    }
    _distanceLinePlane(line, plane) {
        const r = this._intersectLinePlane(line, plane);
        return r && r.ok ? 0 : this._distancePointPlane(line.point, plane);
    }
    _distancePlanePlane(p1, p2) {
        if ((new THREE.Vector3).crossVectors(p1.normal, p2.normal).length() > 1e-12) return 0;
        const n = p1.normal.clone(), denom = Math.max(1e-12, n.length());
        return Math.abs(n.dot(p2.point.clone().sub(p1.point))) / denom;
    }
    _distanceLineLine(l1, l2) {
        const u = l1.dir.clone(), v = l2.dir.clone(), w0 = l1.point.clone().sub(l2.point), uxv = (new THREE.Vector3).crossVectors(u, v);
        return uxv.length() < 1e-12 ? this._distancePointLine(l2.point, l1) : Math.abs(w0.dot(uxv.normalize()));
    }
    _angleBetweenVectorsDegrees(a, b) {
        const na = a.clone().normalize(), nb = b.clone().normalize(), c = Math.min(1, Math.max(-1, na.dot(nb)));
        return 180 * Math.acos(Math.abs(c)) / Math.PI;
    }
    _angleLinePlaneDegrees(line, plane) {
        const n = plane.normal.clone(), v = line.dir.clone(), s = Math.abs(n.clone().normalize().dot(v.clone().normalize()));
        return 180 * Math.asin(Math.min(1, Math.max(0, s))) / Math.PI;
    }
    _anglePlanePlaneDegrees(p1, p2) {
        return this._angleBetweenVectorsDegrees(p1.normal, p2.normal);
    }
    _solveRowSystem(r1, r2, r3, b1, b2, b3) {
        const c1 = (new THREE.Vector3).crossVectors(r2, r3), c2 = (new THREE.Vector3).crossVectors(r3, r1), c3 = (new THREE.Vector3).crossVectors(r1, r2), det = r1.dot(c1);
        return Math.abs(det) < 1e-12 ? {
            ok: !1
        } : {
            ok: !0,
            x: (new THREE.Vector3).add(c1.clone().multiplyScalar(b1)).add(c2.clone().multiplyScalar(b2)).add(c3.clone().multiplyScalar(b3)).multiplyScalar(1 / det)
        };
    }
    _triangleNormal(A, B, C) {
        return (new THREE.Vector3).crossVectors(B.clone().sub(A), C.clone().sub(A));
    }
    _triangleIncenter(A, B, C) {
        const a = B.distanceTo(C), b = A.distanceTo(C), c = A.distanceTo(B), per = a + b + c;
        if (!(per > 1e-12)) return {
            ok: !1
        };
        const I = new THREE.Vector3((a * A.x + b * B.x + c * C.x) / per, (a * A.y + b * B.y + c * C.y) / per, (a * A.z + b * B.z + c * C.z) / per), r = this._distancePointLine(I, {
            point: A,
            dir: B.clone().sub(A)
        }), n = this._triangleNormal(A, B, C).normalize();
        return r > 1e-12 && n.length() > 0 ? {
            ok: !0,
            center: I,
            radius: r,
            normal: n
        } : {
            ok: !1
        };
    }
    _triangleCircumcenter(A, B, C) {
        const u = B.clone().sub(A), v = C.clone().sub(A), n = (new THREE.Vector3).crossVectors(u, v);
        if (n.length() < 1e-12) return {
            ok: !1
        };
        const b1 = .5 * (B.lengthSq() - A.lengthSq()), b2 = .5 * (C.lengthSq() - A.lengthSq()), b3 = n.dot(A), sol = this._solveRowSystem(u, v, n, b1, b2, b3);
        if (!sol.ok) return {
            ok: !1
        };
        const O = sol.x, r = O.distanceTo(A);
        return {
            ok: !0,
            center: O,
            radius: r,
            normal: n.clone().normalize()
        };
    }
    _buildPlaneBasisFromPoints(points) {
        if (!points || points.length < 3) return {
            ok: !1
        };
        const P0 = points[0];
        let i1 = -1, i2 = -1;
        for (let i = 1; i < points.length; i++) if (!points[i].equals(P0)) {
            i1 = i;
            break;
        }
        if (-1 === i1) return {
            ok: !1
        };
        for (let j = i1 + 1; j < points.length; j++) if ((new THREE.Vector3).crossVectors(points[i1].clone().sub(P0), points[j].clone().sub(P0)).length() > 1e-12) {
            i2 = j;
            break;
        }
        if (-1 === i2) return {
            ok: !1
        };
        const e1raw = points[i1].clone().sub(P0), e1 = e1raw.clone().multiplyScalar(1 / e1raw.length()), n = (new THREE.Vector3).crossVectors(e1, points[i2].clone().sub(P0)).normalize();
        if (!(n.length() > 1e-12)) return {
            ok: !1
        };
        const e2 = (new THREE.Vector3).crossVectors(n, e1).normalize();
        return {
            ok: !0,
            origin: P0.clone(),
            n: n,
            e1: e1,
            e2: e2
        };
    }
    _projectPointsTo2D(points, origin, e1, e2) {
        return points.map(P => {
            const v = P.clone().sub(origin);
            return {
                x: v.dot(e1),
                y: v.dot(e2)
            };
        });
    }
    _circleFromThree2D(A, B, C) {
        const D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
        if (Math.abs(D) < 1e-12) return {
            ok: !1
        };
        const A2 = A.x * A.x + A.y * A.y, B2 = B.x * B.x + B.y * B.y, C2 = C.x * C.x + C.y * C.y, Ux = (A2 * (B.y - C.y) + B2 * (C.y - A.y) + C2 * (A.y - B.y)) / D, Uy = (A2 * (C.x - B.x) + B2 * (A.x - C.x) + C2 * (B.x - A.x)) / D;
        return {
            ok: !0,
            center: {
                x: Ux,
                y: Uy
            },
            radius: Math.hypot(Ux - A.x, Uy - A.y)
        };
    }
    _polygonCircumcircleFromVertices(points) {
        const basis = this._buildPlaneBasisFromPoints(points);
        if (!basis.ok) return {
            ok: !1,
            hint: "Точки коллинеарны"
        };
        const p2 = this._projectPointsTo2D(points, basis.origin, basis.e1, basis.e2);
        let tri = null;
        for (let i = 0; i < p2.length && !tri; i++) for (let j = i + 1; j < p2.length && !tri; j++) for (let k = j + 1; k < p2.length && !tri; k++) Math.abs((p2[j].x - p2[i].x) * (p2[k].y - p2[i].y) - (p2[j].y - p2[i].y) * (p2[k].x - p2[i].x)) > 1e-12 && (tri = [ i, j, k ]);
        if (!tri) return {
            ok: !1,
            hint: "Точки коллинеарны"
        };
        const c = this._circleFromThree2D(p2[tri[0]], p2[tri[1]], p2[tri[2]]);
        if (!c.ok) return {
            ok: !1,
            hint: "Окружность не определена"
        };
        const tol = Math.max(1e-6, 1e-4 * c.radius);
        for (let i = 0; i < p2.length; i++) {
            const d = Math.hypot(p2[i].x - c.center.x, p2[i].y - c.center.y);
            if (Math.abs(d - c.radius) > tol) return {
                ok: !1,
                hint: "Многоугольник не циклический"
            };
        }
        return {
            ok: !0,
            center: basis.origin.clone().add(basis.e1.clone().multiplyScalar(c.center.x)).add(basis.e2.clone().multiplyScalar(c.center.y)),
            radius: c.radius,
            normal: basis.n
        };
    }
    _polygonIncircleFromVertices(points) {
        const basis = this._buildPlaneBasisFromPoints(points);
        if (!basis.ok) return {
            ok: !1,
            hint: "Точки коллинеарны"
        };
        const p = this._projectPointsTo2D(points, basis.origin, basis.e1, basis.e2), n = p.length;
        if (n < 3) return {
            ok: !1,
            hint: "Минимум 3 точки"
        };
        const dir = (a, b) => {
            const v = {
                x: b.x - a.x,
                y: b.y - a.y
            }, L = Math.hypot(v.x, v.y);
            return L > 0 ? {
                x: v.x / L,
                y: v.y / L
            } : {
                x: 0,
                y: 0
            };
        }, bisector = i => {
            const prev = p[(i - 1 + n) % n], cur = p[i], next = p[(i + 1) % n], u = dir(cur, prev), v = dir(cur, next), d = {
                x: u.x + v.x,
                y: u.y + v.y
            }, L = Math.hypot(d.x, d.y);
            return L > 1e-12 ? {
                p: cur,
                d: {
                    x: d.x / L,
                    y: d.y / L
                }
            } : null;
        }, cross2 = (a, b) => a.x * b.y - a.y * b.x, sub2 = (a, b) => ({
            x: a.x - b.x,
            y: a.y - b.y
        });
        let b1 = null, b2 = null, i = 0;
        for (;i < n && !b1; ) b1 = bisector(i++);
        let j = i;
        for (;j < n && !b2; ) b2 = bisector(j++);
        if (!b1 || !b2) return {
            ok: !1,
            hint: "Внутренние биссектрисы не определены"
        };
        const denom = cross2(b1.d, b2.d);
        if (Math.abs(denom) < 1e-12) return {
            ok: !1,
            hint: "Биссектрисы параллельны"
        };
        const t = cross2(sub2(b2.p, b1.p), b2.d) / denom, O2 = {
            x: b1.p.x + b1.d.x * t,
            y: b1.p.y + b1.d.y * t
        }, dists = new Array(n).fill(0).map((_, k) => (i => {
            const a = p[i], b = p[(i + 1) % n], ab = {
                x: b.x - a.x,
                y: b.y - a.y
            }, num = Math.abs(cross2(ab, sub2(O2, a))), den = Math.hypot(ab.x, ab.y);
            return den > 0 ? num / den : 0;
        })(k)), r = dists.reduce((s, v) => s + v, 0) / n;
        return Math.sqrt(dists.reduce((s, v) => s + (v - r) * (v - r), 0) / n) > Math.max(1e-6, .001 * r) ? {
            ok: !1,
            hint: "Многоугольник не касательный (нет единственной вписанной окружности)"
        } : {
            ok: !0,
            center: basis.origin.clone().add(basis.e1.clone().multiplyScalar(O2.x)).add(basis.e2.clone().multiplyScalar(O2.y)),
            radius: r,
            normal: basis.n
        };
    }
    _polygonAreaFromPoints(points) {
        const basis = this._buildPlaneBasisFromPoints(points);
        if (!basis.ok) return 0;
        const p2 = this._projectPointsTo2D(points, basis.origin, basis.e1, basis.e2);
        let area2 = 0;
        for (let i = 0; i < p2.length; i++) {
            const a = p2[i], b = p2[(i + 1) % p2.length];
            area2 += a.x * b.y - a.y * b.x;
        }
        return .5 * Math.abs(area2);
    }
    _polygonPerimeterFromPoints(points) {
        if (!points || points.length < 2) return 0;
        let p = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            p += a.distanceTo(b);
        }
        return p;
    }
    _matchFigureToken(tok) {
        const t = String(tok || "").trim().toLowerCase();
        return t && {
            "фигура": "current",
            figure: "current",
            "текущая": "current",
            current: "current",
            "куб": "cube",
            cube: "cube",
            "параллелепипед": "parallelepiped",
            parallelepiped: "parallelepiped",
            "призма": "prism",
            prism: "prism",
            "пирамида": "pyramid",
            pyramid: "pyramid",
            "тетраэдр": "tetrahedron",
            tetrahedron: "tetrahedron",
            "цилиндр": "cylinder",
            cylinder: "cylinder",
            "конус": "cone",
            cone: "cone",
            "сфера": "sphere",
            sphere: "sphere"
        }[t] || null;
    }
    _computeSurfaceAreaFromGeometry(geometry) {
        const pos = geometry.getAttribute && geometry.getAttribute("position");
        if (!pos) return 0;
        const index = geometry.getIndex && geometry.getIndex();
        let area = 0;
        const v = i => (new THREE.Vector3).fromBufferAttribute(pos, i), tri = (i0, i1, i2) => {
            const A = v(i0), B = v(i1), C = v(i2);
            return .5 * (new THREE.Vector3).crossVectors(B.clone().sub(A), C.clone().sub(A)).length();
        };
        if (index) {
            const arr = index.array;
            for (let i = 0; i + 2 < arr.length; i += 3) area += tri(arr[i], arr[i + 1], arr[i + 2]);
        } else for (let i = 0; i + 2 < pos.count; i += 3) area += tri(i, i + 1, i + 2);
        return area;
    }
    _computeTotalEdgeLengthFromGeometry(geometry) {
        let edgesGeom;
        try {
            edgesGeom = new THREE.EdgesGeometry(geometry);
        } catch (_) {
            return 0;
        }
        const pos = edgesGeom.getAttribute && edgesGeom.getAttribute("position");
        if (!pos) return 0;
        let sum = 0;
        const v = i => (new THREE.Vector3).fromBufferAttribute(pos, i);
        for (let i = 0; i + 1 < pos.count; i += 2) {
            const A = v(i), B = v(i + 1);
            sum += A.distanceTo(B);
        }
        return sum;
    }
    _computeVolumeFromGeometry(geometry) {
        const pos = geometry.getAttribute && geometry.getAttribute("position");
        if (!pos) return 0;
        const index = geometry.getIndex && geometry.getIndex(), v = i => (new THREE.Vector3).fromBufferAttribute(pos, i);
        let vol6 = 0;
        if (index) {
            const arr = index.array;
            for (let i = 0; i + 2 < arr.length; i += 3) {
                const A = v(arr[i]), B = v(arr[i + 1]), C = v(arr[i + 2]);
                vol6 += A.dot((new THREE.Vector3).crossVectors(B, C));
            }
        } else for (let i = 0; i + 2 < pos.count; i += 3) {
            const A = v(i), B = v(i + 1), C = v(i + 2);
            vol6 += A.dot((new THREE.Vector3).crossVectors(B, C));
        }
        return Math.abs(vol6) / 6;
    }
    _parseFaceVertexNames(faceStr) {
        const inner = String(faceStr || "").trim();
        return inner.length && inner.match(/[A-Za-z](?:_\d+)?/g) || [];
    }
    _parseFacesFromString(inside) {
        const s = String(inside || "").trim();
        let i = 0;
        const n = s.length, faces = [];
        for (;i < n; ) {
            for (;i < n && /[\s,]/.test(s[i]); ) i++;
            if (i >= n) break;
            if ("(" !== s[i]) return {
                ok: !1,
                hint: "Ожидались скобки для граней: (ABC),(ACD),..."
            };
            let depth = 0, start = i + 1, j = i;
            for (;j < n; j++) if ("(" === s[j]) depth++; else if (")" === s[j] && (depth--, 
            0 === depth)) break;
            if (0 !== depth) return {
                ok: !1,
                hint: "Непарные скобки в описании граней"
            };
            const content = s.slice(start, j);
            for (faces.push(content), i = j + 1; i < n && /[\s,]/.test(s[i]); ) i++;
        }
        if (0 === faces.length) return {
            ok: !1,
            hint: "Не найдены грани"
        };
        const facesNames = [], facesPoints = [];
        for (const f of faces) {
            const names = this._parseFaceVertexNames(f);
            if (names.length < 3) return {
                ok: !1,
                hint: "В грани должно быть минимум 3 вершины"
            };
            const pts = names.map(nm => this.getPointByName(nm)), missing = names.filter((nm, idx) => !pts[idx]);
            if (missing.length) return {
                ok: !1,
                hint: `Точки не найдены: ${missing.join(", ")}`
            };
            facesNames.push(names), facesPoints.push(pts);
        }
        return {
            ok: !0,
            facesNames: facesNames,
            facesPoints: facesPoints
        };
    }
    _validateAndOrientFaces(facesNames) {
        const m = facesNames.length, undirectedCount = new Map, edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
        for (let fi = 0; fi < m; fi++) {
            const fn = facesNames[fi];
            for (let i = 0; i < fn.length; i++) {
                const k = edgeKey(fn[i], fn[(i + 1) % fn.length]);
                undirectedCount.set(k, (undirectedCount.get(k) || 0) + 1);
            }
        }
        if ([ ...undirectedCount.entries() ].filter(([_, c]) => 2 !== c).length) return {
            ok: !1,
            hint: "Оболочка не замкнута (ребра не по 2 на грань)"
        };
        const oriented = facesNames.map(arr => arr.slice()), visited = new Array(m).fill(!1), adj = new Map;
        for (let fi = 0; fi < m; fi++) {
            const fn = oriented[fi];
            for (let i = 0; i < fn.length; i++) {
                const a = fn[i], b = fn[(i + 1) % fn.length], k = edgeKey(a, b);
                adj.has(k) || adj.set(k, []), adj.get(k).push({
                    face: fi,
                    dir: `${a}->${b}`
                });
            }
        }
        const queue = [ 0 ];
        for (visited[0] = !0; queue.length; ) {
            const cur = queue.shift(), fn = oriented[cur];
            for (let i = 0; i < fn.length; i++) {
                const a = fn[i], b = fn[(i + 1) % fn.length], k = edgeKey(a, b), faces = adj.get(k) || [];
                for (const ent of faces) {
                    const nb = ent.face;
                    if (nb === cur) continue;
                    const neighbor = oriented[nb];
                    let nbDir = null;
                    for (let j = 0; j < neighbor.length; j++) {
                        const u = neighbor[j], v = neighbor[(j + 1) % neighbor.length];
                        if (u === a && v === b) {
                            nbDir = "forward";
                            break;
                        }
                        if (u === b && v === a) {
                            nbDir = "backward";
                            break;
                        }
                    }
                    if (visited[nb]) {
                        if ("forward" === nbDir) {
                            neighbor.reverse();
                            let ok = !1;
                            for (let j = 0; j < neighbor.length; j++) {
                                const u = neighbor[j], v = neighbor[(j + 1) % neighbor.length];
                                if (u === b && v === a) {
                                    ok = !0;
                                    break;
                                }
                            }
                            if (!ok) return {
                                ok: !1,
                                hint: "Не удалось согласовать ориентации граней"
                            };
                        }
                    } else "forward" === nbDir && neighbor.reverse(), visited[nb] = !0, queue.push(nb);
                }
            }
        }
        return {
            ok: !0,
            facesNames: oriented
        };
    }
    _triangulatePolygon2D(points2D) {
        const n = points2D.length;
        if (n < 3) return [];
        const idxs = Array.from({
            length: n
        }, (_, i) => i), orientCCW = (arr => {
            let s = 0;
            for (let i = 0; i < arr.length; i++) {
                const a = points2D[arr[i]], b = points2D[arr[(i + 1) % arr.length]];
                s += a.x * b.y - a.y * b.x;
            }
            return s;
        })(idxs) > 0, cross = (ax, ay, bx, by) => ax * by - ay * bx, isConvexAt = (i0, i1, i2) => {
            const A = points2D[i0], B = points2D[i1], C = points2D[i2], z = cross(B.x - A.x, B.y - A.y, C.x - B.x, C.y - B.y);
            return orientCCW ? z > 1e-12 : z < -1e-12;
        }, pointInTri = (P, A, B, C) => {
            const s = cross(C.x - A.x, C.y - A.y, P.x - A.x, P.y - A.y), t = cross(A.x - B.x, A.y - B.y, P.x - B.x, P.y - B.y), u = cross(B.x - C.x, B.y - C.y, P.x - C.x, P.y - C.y);
            return orientCCW ? s >= -1e-12 && t >= -1e-12 && u >= -1e-12 : s <= 1e-12 && t <= 1e-12 && u <= 1e-12;
        }, tris = [];
        let guard = 0;
        for (;idxs.length > 3 && guard++ < 1e4; ) {
            let earFound = !1;
            for (let k = 0; k < idxs.length; k++) {
                const i0 = idxs[(k - 1 + idxs.length) % idxs.length], i1 = idxs[k], i2 = idxs[(k + 1) % idxs.length];
                if (!isConvexAt(i0, i1, i2)) continue;
                const A = points2D[i0], B = points2D[i1], C = points2D[i2];
                let contains = !1;
                for (let t = 0; t < idxs.length; t++) {
                    const ii = idxs[t];
                    if (ii !== i0 && ii !== i1 && ii !== i2 && pointInTri(points2D[ii], A, B, C)) {
                        contains = !0;
                        break;
                    }
                }
                if (!contains) {
                    tris.push([ i0, i1, i2 ]), idxs.splice(k, 1), earFound = !0;
                    break;
                }
            }
            if (!earFound) break;
        }
        if (3 === idxs.length && tris.push([ idxs[0], idxs[1], idxs[2] ]), 0 === tris.length) for (let i = 1; i + 1 < points2D.length; i++) tris.push([ 0, i, i + 1 ]);
        return tris;
    }
    _triangulateFacePoints(points3D) {
        const basis = this._buildPlaneBasisFromPoints(points3D);
        if (!basis.ok) return {
            ok: !1,
            hint: "Вершины грани коллинеарны"
        };
        const p2 = this._projectPointsTo2D(points3D, basis.origin, basis.e1, basis.e2), triIdx = this._triangulatePolygon2D(p2);
        return triIdx.length ? {
            ok: !0,
            triangles: triIdx.map(([i, j, k]) => [ points3D[i], points3D[j], points3D[k] ])
        } : {
            ok: !1,
            hint: "Не удалось трианг."
        };
    }
    _computeMeshAreaFromFaces(facesPoints) {
        let sum = 0;
        for (const face of facesPoints) {
            const tri = this._triangulateFacePoints(face);
            if (!tri.ok) return {
                ok: !1,
                hint: tri.hint
            };
            for (const [A, B, C] of tri.triangles) sum += .5 * (new THREE.Vector3).crossVectors(B.clone().sub(A), C.clone().sub(A)).length();
        }
        return {
            ok: !0,
            area: sum
        };
    }
    _computeMeshPerimeterFromFaces(facesNames) {
        const seen = new Set;
        let sum = 0;
        const key = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
        for (const fn of facesNames) for (let i = 0; i < fn.length; i++) {
            const a = fn[i], b = fn[(i + 1) % fn.length], k = key(a, b);
            if (seen.has(k)) continue;
            const A = this.getPointByName(a), B = this.getPointByName(b);
            if (!A || !B) return {
                ok: !1,
                hint: `Точки не найдены: ${A ? "" : a}${A || B ? "" : ","}${B ? "" : b}`
            };
            sum += A.distanceTo(B), seen.add(k);
        }
        return {
            ok: !0,
            length: sum
        };
    }
    _computeMeshVolumeFromFaces(facesPoints) {
        let vol6 = 0;
        for (const face of facesPoints) {
            const tri = this._triangulateFacePoints(face);
            if (!tri.ok) return {
                ok: !1,
                hint: tri.hint
            };
            for (const [A, B, C] of tri.triangles) vol6 += A.dot((new THREE.Vector3).crossVectors(B, C));
        }
        return {
            ok: !0,
            volume: Math.abs(vol6) / 6
        };
    }
    _tetraInsphere(A, B, C, D) {
        const area = (P, Q, R) => .5 * (new THREE.Vector3).crossVectors(Q.clone().sub(P), R.clone().sub(P)).length(), SA = area(B, C, D), SB = area(A, C, D), SC = area(A, B, D), SD = area(A, B, C), sum = SA + SB + SC + SD;
        if (!(sum > 1e-12)) return {
            ok: !1
        };
        const O = new THREE.Vector3((SA * A.x + SB * B.x + SC * C.x + SD * D.x) / sum, (SA * A.y + SB * B.y + SC * C.y + SD * D.y) / sum, (SA * A.z + SB * B.z + SC * C.z + SD * D.z) / sum), plane = this._planeFromThreePoints(A, B, C);
        return plane.ok ? {
            ok: !0,
            center: O,
            radius: this._distancePointPlane(O, plane)
        } : {
            ok: !1
        };
    }
    _tetraCircumsphere(A, B, C, D) {
        const u = B.clone().sub(A), v = C.clone().sub(A), w = D.clone().sub(A), b1 = .5 * (B.lengthSq() - A.lengthSq()), b2 = .5 * (C.lengthSq() - A.lengthSq()), b3 = .5 * (D.lengthSq() - A.lengthSq()), sol = this._solveRowSystem(u, v, w, b1, b2, b3);
        if (!sol.ok) return {
            ok: !1
        };
        const O = sol.x, r = O.distanceTo(A);
        return {
            ok: !0,
            center: O,
            radius: r
        };
    }
    _parsePointToken(tok) {
        const t = tok.trim();
        let m = t.match(/^\(\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*(?:,\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*)?\)$/);
        if (m) {
            const x = parseFloat(m[1]), y = parseFloat(m[2]), z = void 0 !== m[3] ? parseFloat(m[3]) : 0;
            return new THREE.Vector3(x, y, z);
        }
        return this.getPointByName(t) || null;
    }
    _parseVectorToken(tok) {
        const t = tok.trim();
        let m = t.match(/^<\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*(?:,\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*)?>$/);
        if (m) {
            const x = parseFloat(m[1]), y = parseFloat(m[2]), z = void 0 !== m[3] ? parseFloat(m[3]) : 0;
            return new THREE.Vector3(x, y, z);
        }
        if (m = t.match(/^(Вектор|Направление)\s*\(([^,]+)\s*,\s*([^\)]+)\)$/i), m) {
            const A = this._parsePointToken(m[2]), B = this._parsePointToken(m[3]);
            if (A && B) return B.clone().sub(A);
        }
        if (this.namedVectors[t]) return this.namedVectors[t].clone();
        const mm = this._normalizeName(t).replace(/\s+/g, "").match(/^([A-Za-z](?:_\d+)?)([A-Za-z](?:_\d+)?)$/);
        if (mm) {
            const A = this.getPointByName(mm[1]), B = this.getPointByName(mm[2]);
            if (A && B) return B.clone().sub(A);
        }
        return null;
    }
    _parseLineExpr(expr) {
        let m = expr.match(/^Прямая\s*\(([^,]+)\s*,\s*([^\)]+)\)$/i);
        if (m) {
            const nameA = m[1].trim(), nameB = m[2].trim(), A = this._parsePointToken(nameA), B = this._parsePointToken(nameB);
            if (A && B) {
                const line = this._lineFromTwoPoints(A, B);
                return line.pointNames = [ nameA, nameB ], {
                    ok: !0,
                    line: line
                };
            }
        }
        const t = String(expr || "").trim(), names = this._extractTwoPointNames(t);
        if (names) {
            const res = this._getTwoPoints(names);
            if (res.ok) {
                const line = this._lineFromTwoPoints(res.points[0], res.points[1]);
                return line.pointNames = names, {
                    ok: !0,
                    line: line
                };
            }
        }
        return this.namedLines && this.namedLines[t] ? {
            ok: !0,
            line: this.namedLines[t]
        } : {
            ok: !1
        };
    }
    _parseRayExpr(expr) {
        let m = expr.match(/^Луч\s*\(([^,]+)\s*,\s*([^\)]+)\)$/i);
        if (m) {
            const A = this._parsePointToken(m[1]), B = this._parsePointToken(m[2]);
            if (A && B) return {
                ok: !0,
                ray: this._rayFromTwoPoints(A, B)
            };
        }
        if (m = String(expr || "").trim().match(/^([A-Za-zА-Яа-я](?:_\d+)?)\s*(?:→|->)\s*([A-Za-zА-Яа-я](?:_\d+)?)$/), 
        m) {
            const A = this.getPointByName(m[1]), B = this.getPointByName(m[2]);
            if (A && B) return {
                ok: !0,
                ray: this._rayFromTwoPoints(A, B)
            };
        }
        return {
            ok: !1
        };
    }
    _parseSegmentExpr(expr) {
        let m = expr.match(/^Отрезок\s*\(([^,]+)\s*,\s*([^\)]+)\)$/i);
        if (m) {
            const A = this._parsePointToken(m[1]), B = this._parsePointToken(m[2]);
            if (A && B) return {
                ok: !0,
                segment: this._segmentFromTwoPoints(A, B)
            };
        }
        if (m = String(expr || "").trim().match(/^\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\]$/), 
        m) {
            const A = this._parsePointToken(m[1]), B = this._parsePointToken(m[2]);
            if (A && B) return {
                ok: !0,
                segment: this._segmentFromTwoPoints(A, B)
            };
        }
        return {
            ok: !1
        };
    }
    _parsePlaneExpr(expr) {
        let m = expr.match(/^Плоскость\s*\(([^,]+)\s*,\s*([^,]+)\s*,\s*([^\)]+)\)$/i);
        if (m) {
            const aTok = m[1].trim(), bTok = m[2].trim(), cTok = m[3].trim(), pts = [ this._parsePointToken(aTok), this._parsePointToken(bTok), this._parsePointToken(cTok) ], vecs = [ this._parseVectorToken(aTok), this._parseVectorToken(bTok), this._parseVectorToken(cTok) ], toks = [ aTok, bTok, cTok ];
            for (let i = 0; i < 3; i++) {
                const P = pts[i];
                if (!P) continue;
                const candidates = [ (i + 1) % 3, (i + 2) % 3 ], v1 = vecs[candidates[0]], v2 = vecs[candidates[1]];
                if (v1 && v2) {
                    const n = (new THREE.Vector3).crossVectors(v1, v2);
                    if (n.length() < 1e-9) return {
                        ok: !1,
                        hint: "Векторы коллинеарны; плоскость не определена"
                    };
                    const pl = this._planeFromPointNormal(P, n);
                    return pl.ok ? {
                        ok: !0,
                        plane: pl
                    } : {
                        ok: !1,
                        hint: "Плоскость не определена"
                    };
                }
            }
            const res = this._getThreePoints(toks);
            if (!res.ok) return res;
            const [A, B, C] = res.points, pl = this._planeFromThreePoints(A, B, C);
            return pl.ok ? {
                ok: !0,
                plane: pl
            } : {
                ok: !1,
                hint: "Точки коллинеарны; плоскость не определена"
            };
        }
        if (m = expr.match(/^Плоскость\s*\(([^,]+)\s*,\s*(<[^>]+>)\)$/i), m) {
            const pTok = m[1].trim(), nTok = m[2].trim(), P = this._parsePointToken(pTok), n = this._parseVectorToken(nTok);
            if (!P) return {
                ok: !1,
                hint: `Точка не распознана: ${pTok}`
            };
            if (!n) return {
                ok: !1,
                hint: `Нормаль не распознана: ${nTok}`
            };
            const pl = this._planeFromPointNormal(P, n);
            return pl.ok ? {
                ok: !0,
                plane: pl
            } : {
                ok: !1,
                hint: "Нулевая нормаль; плоскость не определена"
            };
        }
        if (m = expr.match(/^Плоскость\s*\(([^,]+)\s*,\s*([^\)]+)\)$/i), m) {
            const aTok = m[1].trim(), bTok = m[2].trim();
            let P = this._parsePointToken(aTok), n = this._parseVectorToken(bTok);
            if (P && n) {
                const pl = this._planeFromPointNormal(P, n);
                return pl.ok ? {
                    ok: !0,
                    plane: pl
                } : {
                    ok: !1,
                    hint: "Нулевая нормаль; плоскость не определена"
                };
            }
            if (n = this._parseVectorToken(aTok), P = this._parsePointToken(bTok), n && P) {
                const pl = this._planeFromPointNormal(P, n);
                return pl.ok ? {
                    ok: !0,
                    plane: pl
                } : {
                    ok: !1,
                    hint: "Нулевая нормаль; плоскость не определена"
                };
            }
            let l = this._parseLineExpr(aTok);
            if (P = this._parsePointToken(bTok), l.ok && P) {
                const v = l.line.dir.clone(), w = P.clone().sub(l.line.point), n = (new THREE.Vector3).crossVectors(v, w);
                if (n.length() < 1e-9) return {
                    ok: !1,
                    hint: "Точка лежит на прямой; плоскость не определена"
                };
                const pl = this._planeFromPointNormal(P, n);
                return pl.ok ? {
                    ok: !0,
                    plane: pl
                } : {
                    ok: !1,
                    hint: "Плоскость не определена"
                };
            }
            if (P = this._parsePointToken(aTok), l = this._parseLineExpr(bTok), P && l.ok) {
                const v = l.line.dir.clone(), w = P.clone().sub(l.line.point), n = (new THREE.Vector3).crossVectors(v, w);
                if (n.length() < 1e-9) return {
                    ok: !1,
                    hint: "Точка лежит на прямой; плоскость не определена"
                };
                const pl = this._planeFromPointNormal(P, n);
                return pl.ok ? {
                    ok: !0,
                    plane: pl
                } : {
                    ok: !1,
                    hint: "Плоскость не определена"
                };
            }
            let l1 = this._parseLineExpr(aTok), l2 = this._parseLineExpr(bTok);
            if (l1.ok && l2.ok) {
                const u = l1.line.dir.clone(), v = l2.line.dir.clone(), cross = (new THREE.Vector3).crossVectors(u, v);
                if (cross.length() > 1e-9) {
                    const r = this._intersectLines3D(l1.line.point, l1.line.point.clone().add(l1.line.dir), l2.line.point, l2.line.point.clone().add(l2.line.dir));
                    if (!r.ok) return {
                        ok: !1,
                        hint: "Прямые скрещиваются; нет единственной плоскости"
                    };
                    const pl = this._planeFromPointNormal(r.point, cross);
                    return pl.ok ? {
                        ok: !0,
                        plane: pl
                    } : {
                        ok: !1,
                        hint: "Плоскость не определена"
                    };
                }
                {
                    const w = l2.line.point.clone().sub(l1.line.point), n = (new THREE.Vector3).crossVectors(u, w);
                    if (n.length() < 1e-9) return {
                        ok: !1,
                        hint: "Прямые совпадают; добавьте отличную вторую прямую"
                    };
                    const pl = this._planeFromPointNormal(l1.line.point, n);
                    return pl.ok ? {
                        ok: !0,
                        plane: pl
                    } : {
                        ok: !1,
                        hint: "Плоскость не определена"
                    };
                }
            }
            const aLooksLikeLine = /^(Прямая\s*\(|[A-Za-zА-Яа-я](?:_\d+)?\s*,\s*[A-Za-zА-Яа-я](?:_\d+)?|[A-Za-zА-Яа-я](?:_\d+)?[A-Za-zА-Яа-я](?:_\d+)?)$/i.test(aTok.replace(/\s+/g, " ")), bLooksLikeLine = /^(Прямая\s*\(|[A-Za-zА-Яа-я](?:_\d+)?\s*,\s*[A-Za-zА-Яа-я](?:_\d+)?|[A-Za-zА-Яа-я](?:_\d+)?[A-Za-zА-Яа-я](?:_\d+)?)$/i.test(bTok.replace(/\s+/g, " "));
            if (aLooksLikeLine || bLooksLikeLine) return {
                ok: !1,
                hint: "Ожидались прямая и точка либо точка и нормаль"
            };
        }
        const t = String(expr || "").trim(), names = this._extractThreePointNames(t);
        if (names) {
            const res = this._getThreePoints(names);
            if (!res.ok) return res;
            const [A, B, C] = res.points, pl = this._planeFromThreePoints(A, B, C);
            return pl.ok ? {
                ok: !0,
                plane: pl
            } : {
                ok: !1,
                hint: "Точки коллинеарны; плоскость не определена"
            };
        }
        return this.namedPlanes && this.namedPlanes[t] ? {
            ok: !0,
            plane: this.namedPlanes[t]
        } : {
            ok: !1,
            hint: "Плоскость не распознана"
        };
    }
    async showHelpModal() {
        const overlay = document.getElementById("help-overlay"), box = document.getElementById("help-box"), closeBtn = document.getElementById("help-close");
        if (!overlay || !box || !closeBtn) return;
        overlay.classList.remove("hidden"), overlay.classList.add("flex");
        const close = () => {
            overlay.classList.add("hidden"), overlay.classList.remove("flex");
        };
        overlay.addEventListener("click", e => {
            e.target === overlay && close();
        }), closeBtn.addEventListener("click", close, {
            once: !0
        }), box.querySelectorAll(".copy-example").forEach(btn => {
            btn.dataset.bound || (btn.dataset.bound = "1", btn.addEventListener("click", async e => {
                e.stopPropagation();
                const card = btn.closest(".relative"), codeEl = card && card.querySelector(".example-code");
                if (!codeEl) return;
                const text = codeEl.textContent || "";
                try {
                    await navigator.clipboard.writeText(text), btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.6097 5.20743C21.0475 5.54416 21.1294 6.17201 20.7926 6.60976L10.7926 19.6098C10.6172 19.8378 10.352 19.9793 10.0648 19.9979C9.77765 20.0166 9.49637 19.9106 9.29289 19.7072L4.29289 14.7072C3.90237 14.3166 3.90237 13.6835 4.29289 13.2929C4.68342 12.9024 5.31658 12.9024 5.70711 13.2929L9.90178 17.4876L19.2074 5.39034C19.5441 4.95258 20.172 4.87069 20.6097 5.20743Z" fill="#ffffff"/></svg>', 
                    setTimeout(() => {
                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none"><path d="M3 16V4C3 2.89543 3.89543 2 5 2H15M9 22H18C19.1046 22 20 21.1046 20 20V8C20 6.89543 19.1046 6 18 6H9C7.89543 6 7 6.89543 7 8V20C7 21.1046 7.89543 22 9 22Z" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    }, 1e3);
                } catch (_) {
                    const area = document.createElement("textarea");
                    area.value = text, area.className = "fixed opacity-0", document.body.appendChild(area), 
                    area.select();
                    try {
                        document.execCommand("copy"), btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.6097 5.20743C21.0475 5.54416 21.1294 6.17201 20.7926 6.60976L10.7926 19.6098C10.6172 19.8378 10.352 19.9793 10.0648 19.9979C9.77765 20.0166 9.49637 19.9106 9.29289 19.7072L4.29289 14.7072C3.90237 14.3166 3.90237 13.6835 4.29289 13.2929C4.68342 12.9024 5.31658 12.9024 5.70711 13.2929L9.90178 17.4876L19.2074 5.39034C19.5441 4.95258 20.172 4.87069 20.6097 5.20743Z" fill="#ffffff"/></svg>', 
                        setTimeout(() => {
                            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" fill="none"><path d="M3 16V4C3 2.89543 3.89543 2 5 2H15M9 22H18C19.1046 22 20 21.1046 20 20V8C20 6.89543 19.1046 6 18 6H9C7.89543 6 7 6.89543 7 8V20C7 21.1046 7.89543 22 9 22Z" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                        }, 1e3);
                    } catch (_) {}
                    document.body.removeChild(area);
                }
            }));
        });
    }
    createSidebarUI() {
        const toggle = document.getElementById("figure-select-toggle"), menu = document.getElementById("figure-selector");
        if (toggle && menu) {
            menu.querySelectorAll(".figure-option").forEach(option => {
                const figureKey = option.getAttribute("data-figure");
                figureKey && this.figures[figureKey] && option.addEventListener("click", async () => {
                    toggle.textContent = this.figures[figureKey].name, menu.classList.add("hidden"), 
                    await this.updateFigure(figureKey);
                });
            }), toggle.addEventListener("click", () => {
                menu.classList.toggle("hidden");
            }), document.addEventListener("click", e => {
                menu.contains(e.target) || e.target === toggle || menu.classList.add("hidden");
            });
        }
        const paramsDiv = document.getElementById("params");
        paramsDiv && (paramsDiv.addEventListener("input", () => {
            this._paramsDebounce && clearTimeout(this._paramsDebounce), this._paramsDebounce = setTimeout(() => this.updateParams(), 300);
        }), paramsDiv.addEventListener("change", () => this.updateParams()));
    }
    async updateFigure(selectedType = this.currentFigureType) {
        if (this.currentFigureType && selectedType !== this.currentFigureType) {
            const hasUserChanges = !0 === this._userModifiedParams, hasSectionsOrInProgress = Array.isArray(this.sections) && this.sections.length > 0 || Array.isArray(this.currentPoints) && this.currentPoints.length > 0;
            if (hasUserChanges || hasSectionsOrInProgress) {
                const msg = "Предупреждение: все изменения и сечения будут удалены. Продолжить?";
                if (!await this.confirmMessage(msg)) return;
            }
        }
        const figureType = selectedType;
        this.currentFigureType = figureType, this.controls.enableRotate = !0;
        const figure = this.figures[figureType], paramsDiv = document.getElementById("params");
        if (this.figureParams = {}, figure.params.forEach(param => {
            this.figureParams[param.key] = param.default;
        }), this._initialFigureParams = JSON.parse(JSON.stringify(this.figureParams)), this._userModifiedParams = !1, 
        !paramsDiv) return;
        {
            this.renderParams(figure, paramsDiv);
            const typeEl = document.getElementById("param-type");
            typeEl && (typeEl.value = this.figureParams.type || figure.params.find(p => "type" === p.key)?.default || "regular");
        }
        this._removeFigureFromScene(), this.clearFigureOverlays(), this.labelSprites.forEach(sprite => this.scene.remove(sprite)), 
        this.labelSprites = [], this.sections.forEach(({mesh: mesh, edges: edges}) => {
            this.scene.remove(mesh), this._disposeMesh(mesh), this.scene.remove(edges), this._disposeMesh(edges);
        }), Array.isArray(this.sectionLabelSprites) && this.sectionLabelSprites.length > 0 && this.sectionLabelSprites.forEach(sprites => {
            (sprites || []).forEach(sp => {
                this.scene.remove(sp), this._disposeSprite(sp);
            });
        }), this.sectionLabelSprites = [], this.sections = [], this.clearCurrentSection(), 
        this.sectionPointIndex = 0, this.clearFigureOverlays(), this._lastInstructionsText = "";
        const newGeometry = figure.create.bind(this)(this.figureParams);
        if (this._validateGeometry(newGeometry)) {
            if (this.figureGeometry = newGeometry, this.figureGeometry.computeBoundingBox(), 
            this.updateVerticesAndLabels(figureType), this._centerGeometryOnGrid(this.figureGeometry), 
            this._createAndAddFigureToScene(figureType), ("pyramid" === figureType && "regular" === this.figureParams.type || "tetrahedron" === figureType || "cube" === figureType || "parallelepiped" === figureType || "prism" === figureType) && this.vertices.length > 0) {
                let minX = 1 / 0, maxX = -1 / 0, minY = 1 / 0, maxY = -1 / 0, minZ = 1 / 0, maxZ = -1 / 0;
                for (const v of this.vertices) v.x < minX && (minX = v.x), v.x > maxX && (maxX = v.x), 
                v.y < minY && (minY = v.y), v.y > maxY && (maxY = v.y), v.z < minZ && (minZ = v.z), 
                v.z > maxZ && (maxZ = v.z);
                const centerX = (maxX + minX) / 2, centerZ = (maxZ + minZ) / 2, analyticalTranslation = new THREE.Vector3(-centerX, -minY, -centerZ), translatedVertices = [];
                for (let i = 0; i < this.vertices.length; i++) {
                    const translated = this.vertices[i].clone().add(analyticalTranslation);
                    translatedVertices.push(translated), this.vertexLabels.length;
                }
                this.vertices = translatedVertices, this._geometryTranslation = analyticalTranslation;
            } else {
                this.vertices, this.vertices = [];
                const position = this.figureGeometry.getAttribute("position");
                if (position) for (let i = 0; i < Math.min(position.count, this.vertexLabels.length); i++) {
                    const v = (new THREE.Vector3).fromBufferAttribute(position, i);
                    this.vertices.push(v), this.vertexLabels.length;
                }
            }
            if (this.initLabels(this.vertexLabelEpoch), this.figureGeometry && this.figureGeometry.boundingBox && (this._updateGridForBBox(this.figureGeometry.boundingBox), 
            this._updateCameraForBBox(this.figureGeometry.boundingBox)), this.smoothFigures.has(figureType) && this.namedCircles) {
                const nc = this.namedCircles;
                Object.keys(nc).forEach(k => {
                    const c = nc[k];
                    c && c.center && c.normal && c.radius && this.createFigureOverlayCircle(c.center, c.normal, c.radius, "#000000");
                });
            }
            this.parseAndApplyInstructions();
        }
    }
    addGrid(size = 10, divisions = 10) {
        this.grid && this.scene.remove(this.grid), this.grid = new THREE.GridHelper(size, divisions, 6710886, 6710886), 
        this.grid.material.transparent = !0, this.grid.material.opacity = .25, this.scene.add(this.grid), 
        this._gridSize = size, this._gridDivisions = divisions;
    }
    renderParams(figure, paramsDiv) {
        const errorDiv = document.getElementById("params-error");
        Array.from(paramsDiv.children).forEach(child => {
            "params-error" !== child.id && child.remove();
        }), errorDiv && (errorDiv.textContent = ""), figure.params.forEach(param => {
            if (param.condition && !param.condition(this.figureParams) && ("tetrahedron" !== this.currentFigureType || "edge" !== param.key || "regular" !== this.figureParams.type)) return;
            let labelText = param.name;
            [ "AB", "AD", "AA1" ].includes(param.key) && ("AB" === param.key && (labelText = `Длина ${this.vertexLabels[0] || "A"}${this.vertexLabels[1] || "B"}`), 
            "AD" === param.key && (labelText = `Длина ${this.vertexLabels[0] || "A"}${this.vertexLabels[3] || "D"}`), 
            "AA1" === param.key && (labelText = `Высота ${this.vertexLabels[0] || "A"}${this.vertexLabels[4] || "A_1"}`));
            const label = document.createElement("label");
            this._renderLabelWithEdgeKaTeX(label, labelText);
            const input = document.createElement("select" === param.type ? "select" : "input");
            "select" === param.type ? (param.options.forEach(opt => {
                const option = document.createElement("option");
                option.value = opt;
                let text = opt;
                "type" === param.key ? text = "regular" === opt ? "Правильный" : "Неправильный" : "orientation" === param.key && (text = "right" === opt ? "Прямая" : "Наклонная"), 
                option.text = text, input.appendChild(option);
            }), input.value = this.figureParams[param.key] ?? param.default) : (input.type = "number", 
            null != param.min && (input.min = String(param.min)), null != param.max && (input.max = String(param.max)), 
            input.step = "integer" === param.type ? "1" : "any", input.value = String(this.figureParams[param.key] ?? param.default)), 
            input.id = `param-${param.key}`, paramsDiv.appendChild(label), paramsDiv.appendChild(input), 
            "select" === param.type && "type" === param.key ? input.addEventListener("change", () => {
                this.figureParams.type = input.value, "irregular" === input.value && "tetrahedron" === this.currentFigureType && [ "AB", "AC", "AD", "BC", "BD", "CD" ].forEach(key => {
                    key in this.figureParams || (this.figureParams[key] = 2);
                }), this.renderParams(figure, paramsDiv), this.updateParams();
            }) : "sides" === param.key && input.addEventListener("change", () => {
                this.figureParams.sides = Math.max(3, parseInt(input.value) || param.default), this.renderParams(figure, paramsDiv), 
                this.updateParams();
            });
        }), "irregular" === this.figureParams.type && this.addIrregularParams(figure, paramsDiv);
    }
    addIrregularParams(figure, paramsDiv) {
        const figureType = this.currentFigureType;
        if ("prism" === figureType || "pyramid" === figureType) {
            const sides = this.figureParams.sides;
            for (let i = 0; i < sides; i++) {
                const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % sides), param = {
                    name: `Длина ${edgeKey}`,
                    key: edgeKey,
                    default: 2
                };
                edgeKey in this.figureParams || (this.figureParams[edgeKey] = param.default);
                const label = document.createElement("label");
                this._renderLabelWithEdgeKaTeX(label, param.name);
                const input = document.createElement("input");
                input.type = "number", input.step = "any", input.min = "0.01", input.value = String(this.figureParams[edgeKey]), 
                input.id = `param-${param.key}`, paramsDiv.appendChild(label), paramsDiv.appendChild(input);
            }
        }
        if ("pyramid" === figureType) for (let i = 0; i < this.figureParams.sides; i++) {
            const apexLabel = this.getVertexLabel(this.figureParams.sides), edgeKey = this.getVertexLabel(i) + apexLabel, param = {
                name: `Длина ${edgeKey}`,
                key: edgeKey,
                default: 2
            };
            edgeKey in this.figureParams || (this.figureParams[edgeKey] = param.default);
            const label = document.createElement("label");
            this._renderLabelWithEdgeKaTeX(label, param.name);
            const input = document.createElement("input");
            input.type = "number", input.step = "any", input.min = "0.01", input.value = String(this.figureParams[edgeKey]), 
            input.id = `param-${param.key}`, paramsDiv.appendChild(label), paramsDiv.appendChild(input);
        }
    }
    updateVerticesAndLabels(figureType) {
        if (this.vertices = [], this.vertexLabels = [], "cube" === figureType) {
            const s = this.figureParams.edge / 2;
            this.vertexLabels = [ "A", "B", "C", "D", "A_1", "B_1", "C_1", "D_1" ], this.vertices = [ new THREE.Vector3(-s, 0, s), new THREE.Vector3(s, 0, s), new THREE.Vector3(s, 0, -s), new THREE.Vector3(-s, 0, -s), new THREE.Vector3(-s, this.figureParams.edge, s), new THREE.Vector3(s, this.figureParams.edge, s), new THREE.Vector3(s, this.figureParams.edge, -s), new THREE.Vector3(-s, this.figureParams.edge, -s) ];
        } else if ("parallelepiped" === figureType) {
            const ab = this.figureParams.AB / 2, ad = this.figureParams.AD / 2, aa1 = this.figureParams.AA1;
            this.vertexLabels = [ "A", "B", "C", "D", "A_1", "B_1", "C_1", "D_1" ], this.vertices = [ new THREE.Vector3(-ab, 0, ad), new THREE.Vector3(ab, 0, ad), new THREE.Vector3(ab, 0, -ad), new THREE.Vector3(-ab, 0, -ad), new THREE.Vector3(-ab, aa1, ad), new THREE.Vector3(ab, aa1, ad), new THREE.Vector3(ab, aa1, -ad), new THREE.Vector3(-ab, aa1, -ad) ];
        } else if ("prism" === figureType) {
            const sides = this.figureParams.sides;
            this.vertexLabels = Array.from({
                length: sides
            }, (_, i) => this.getVertexLabel(i)), this.vertexLabels.push(...Array.from({
                length: sides
            }, (_, i) => `${this.getVertexLabel(i)}_1`));
            const position = this.figureGeometry && this.figureGeometry.getAttribute ? this.figureGeometry.getAttribute("position") : null;
            if (position && position.count >= 2 * sides) for (let i = 0; i < 2 * sides; i++) {
                const v = (new THREE.Vector3).fromBufferAttribute(position, i);
                this.vertices.push(v);
            } else if ("regular" === this.figureParams.type) {
                const r = this.figureParams.baseEdge / (2 * Math.sin(Math.PI / sides)), h = this.figureParams.height;
                let shiftX = 0;
                if ("oblique" === this.figureParams.orientation) {
                    const l = Math.max(this.figureParams.lateralEdge || h, h);
                    shiftX = Math.sqrt(Math.max(0, l * l - h * h));
                }
                const centerShift = .5 * shiftX;
                for (let i = 0; i < sides; i++) {
                    const angle = i / sides * Math.PI * 2, x = r * Math.cos(angle) - centerShift, z = r * Math.sin(angle);
                    this.vertices.push(new THREE.Vector3(x, 0, z));
                }
                for (let i = 0; i < sides; i++) {
                    const angle = i / sides * Math.PI * 2, x = r * Math.cos(angle) + shiftX - centerShift, z = r * Math.sin(angle);
                    this.vertices.push(new THREE.Vector3(x, h, z));
                }
            } else {
                const sideLengths = [];
                for (let i = 0; i < sides; i++) {
                    const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % sides);
                    sideLengths.push(Math.max(.01, this.figureParams[edgeKey] || 2));
                }
                const base = this.buildPolygonVerticesFromSideLengths(sideLengths);
                let shiftX = 0;
                if ("oblique" === this.figureParams.orientation) {
                    const h = this.figureParams.height, l = Math.max(this.figureParams.lateralEdge || h, h);
                    shiftX = Math.sqrt(Math.max(0, l * l - h * h));
                }
                const centerShift = .5 * shiftX;
                for (let i = 0; i < sides; i++) {
                    const x = base[i].x - centerShift, z = base[i].z;
                    this.vertices.push(new THREE.Vector3(x, 0, z));
                }
                for (let i = 0; i < sides; i++) {
                    const h = this.figureParams.height, x = base[i].x + shiftX - centerShift, z = base[i].z;
                    this.vertices.push(new THREE.Vector3(x, h, z));
                }
            }
        } else if ("pyramid" === figureType) {
            const sides = this.figureParams.sides;
            if (this.vertexLabels = Array.from({
                length: sides
            }, (_, i) => this.getVertexLabel(i)), this.vertexLabels.push(this.getVertexLabel(sides)), 
            "regular" === this.figureParams.type) {
                const position = this.figureGeometry && this.figureGeometry.getAttribute ? this.figureGeometry.getAttribute("position") : null;
                if (position && position.count > 0) {
                    const uniqueVertices = [], eps = 1e-6;
                    for (let i = 0; i < position.count; i++) {
                        const v = (new THREE.Vector3).fromBufferAttribute(position, i);
                        let isDuplicate = !1;
                        for (const existing of uniqueVertices) if (v.distanceTo(existing) < eps) {
                            isDuplicate = !0;
                            break;
                        }
                        isDuplicate || uniqueVertices.push(v);
                    }
                    if (uniqueVertices.sort((a, b) => a.y - b.y), uniqueVertices.length >= sides + 1) {
                        const baseVertices = uniqueVertices.slice(0, sides), centerX = baseVertices.reduce((sum, v) => sum + v.x, 0) / baseVertices.length, centerZ = baseVertices.reduce((sum, v) => sum + v.z, 0) / baseVertices.length;
                        baseVertices.sort((a, b) => Math.atan2(a.z - centerZ, a.x - centerX) - Math.atan2(b.z - centerZ, b.x - centerX));
                        for (const v of baseVertices) this.vertices.push(v.clone());
                        this.vertices.push(uniqueVertices[uniqueVertices.length - 1].clone());
                    }
                } else {
                    const r = this.figureParams.baseEdge / (2 * Math.sin(Math.PI / sides));
                    let h = this.figureParams.height;
                    if ("number" == typeof this.figureParams.lateralEdge) {
                        const l = Math.max(0, this.figureParams.lateralEdge), h2 = Math.max(0, l * l - r * r);
                        h = Math.sqrt(h2);
                    }
                    for (let i = 0; i < sides; i++) {
                        const angle = i / sides * Math.PI * 2, x = r * Math.cos(angle), z = r * Math.sin(angle);
                        this.vertices.push(new THREE.Vector3(x, 0, z));
                    }
                    this.vertices.push(new THREE.Vector3(0, h, 0));
                }
            } else {
                const position = this.figureGeometry && this.figureGeometry.getAttribute ? this.figureGeometry.getAttribute("position") : null;
                if (position && position.count >= sides + 1) {
                    for (let i = 0; i < sides; i++) this.vertices.push((new THREE.Vector3).fromBufferAttribute(position, i));
                    const apexVec = (new THREE.Vector3).fromBufferAttribute(position, sides);
                    this.vertices.push(apexVec);
                } else {
                    const sideLengths = [];
                    for (let i = 0; i < sides; i++) {
                        const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % sides);
                        sideLengths.push(Math.max(.01, this.figureParams[edgeKey] || 2));
                    }
                    const base = this.buildPolygonVerticesFromSideLengths(sideLengths);
                    for (let i = 0; i < sides; i++) this.vertices.push(new THREE.Vector3(base[i].x, 0, base[i].z));
                    this.vertices.push(new THREE.Vector3(0, this.figureParams.height, 0));
                }
            }
        } else if ("tetrahedron" === figureType) {
            this.vertexLabels = [ "A", "B", "C", "D" ];
            const position = this.figureGeometry.getAttribute("position");
            for (let i = 0; i < position.count; i++) this.vertices.push((new THREE.Vector3).fromBufferAttribute(position, i));
        } else if ("cylinder" === figureType) this.vertices = [], this.vertexLabels = []; else if ("cone" === figureType) {
            const h = this.figureParams.height;
            this.vertices = [ new THREE.Vector3(0, h, 0) ], this.vertexLabels = [ "S" ];
        } else "sphere" === figureType && (this.vertices = [], this.vertexLabels = []);
        this.labelSprites.forEach(sprite => this.scene.remove(sprite)), this.labelSprites = [], 
        this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1;
    }
    async createLabel(text) {
        if (!text) return null;
        if (this._labelTextureCache[text]) {
            const cachedTexture = this._labelTextureCache[text], spriteMaterial = new THREE.SpriteMaterial({
                map: cachedTexture
            }), sprite = new THREE.Sprite(spriteMaterial);
            return sprite.scale.set(.5, .5, .5), sprite.userData = {
                text: text
            }, sprite;
        }
        const tempDiv = document.createElement("div");
        tempDiv.className = "absolute -left-[9999px] p-[5px] text-[32px] text-black bg-transparent text-center", 
        document.body.appendChild(tempDiv);
        try {
            katex.render(text, tempDiv, {
                throwOnError: !1,
                strict: "ignore",
                displayMode: !0,
                output: "mathml"
            });
        } catch (e) {
            try {
                const safe = String(text).replace(/_/g, "\\_");
                katex.render(safe, tempDiv, {
                    throwOnError: !1,
                    strict: "ignore",
                    displayMode: !0,
                    output: "mathml"
                });
            } catch (e2) {
                tempDiv.textContent = text;
            }
        }
        const canvas = await html2canvas(tempDiv, {
            scale: 3,
            backgroundColor: null,
            width: 128,
            height: 128,
            logging: !1
        });
        document.body.removeChild(tempDiv);
        const texture = new THREE.CanvasTexture(canvas);
        this._labelTextureCache[text] = texture;
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture
        }), sprite = new THREE.Sprite(spriteMaterial);
        return sprite.scale.set(.5, .5, .5), sprite.userData = {
            text: text
        }, sprite;
    }
    async initLabels(epoch) {
        const myEpoch = null == epoch ? this.vertexLabelEpoch || 0 : epoch, myToken = {};
        this.vertexLabelRenderToken = myToken, this.labelSprites.forEach(sprite => this.scene.remove(sprite)), 
        this.labelSprites = [];
        for (let i = 0; i < this.vertices.length; i++) if (this.vertexLabels[i] && this.vertices[i]) try {
            const label = await this.createLabel(this.vertexLabels[i]);
            if ((this.vertexLabelEpoch || 0) !== myEpoch || this.vertexLabelRenderToken !== myToken) return void this._disposeSprite(label);
            if (!label) continue;
            if (!this.vertices[i]) continue;
            const direction = this._getLabelDirection(this.vertices[i]);
            label.position.copy(this.vertices[i]).add(direction.multiplyScalar(.4)), this.scene.add(label), 
            this.labelSprites.push(label);
        } catch (e) {}
    }
    createPointMarker(position) {
        const geometry = new THREE.SphereGeometry(.05, 16, 16), material = new THREE.MeshBasicMaterial({
            color: 16711680
        }), marker = new THREE.Mesh(geometry, material);
        return marker.position.copy(position), this.scene.add(marker), marker;
    }
    createSectionMesh(points, isPreview = !1) {
        if (points.length < 3) return null;
        const p1 = points[0], p2 = points[1], p3 = points[2], v1 = p2.clone().sub(p1), v2 = p3.clone().sub(p1), normal = v1.clone().cross(v2).normalize(), d = -normal.dot(p1), edges = this.getFigureEdges(), intersections = [];
        if (edges.forEach(([a, b]) => {
            const dir = b.clone().sub(a), denom = normal.dot(dir);
            if (Math.abs(denom) > 1e-6) {
                const t = -(normal.dot(a) + d) / denom;
                if (t >= 0 && t <= 1) {
                    const point = a.clone().add(dir.multiplyScalar(t));
                    intersections.push(point);
                }
            }
        }), intersections.length >= 3) {
            const proj = intersections.map(p => {
                const v = p.clone().sub(p1);
                return {
                    point: p,
                    x: v.dot(v1.clone().normalize()),
                    y: v.dot(v2.clone().normalize())
                };
            }), centerX = proj.reduce((sum, p) => sum + p.x, 0) / proj.length, centerY = proj.reduce((sum, p) => sum + p.y, 0) / proj.length;
            proj.sort((a, b) => Math.atan2(a.y - centerY, a.x - centerX) - Math.atan2(b.y - centerY, b.x - centerX));
            const geometry = new THREE.BufferGeometry, positions = new Float32Array(3 * proj.length);
            for (let i = 0; i < proj.length; i++) positions[3 * i] = proj[i].point.x, positions[3 * i + 1] = proj[i].point.y, 
            positions[3 * i + 2] = proj[i].point.z;
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const indices = [];
            for (let i = 1; i < proj.length - 1; i++) indices.push(0, i, i + 1);
            geometry.setIndex(indices);
            const material = new THREE.MeshBasicMaterial({
                color: 65280,
                side: THREE.DoubleSide,
                transparent: !0,
                opacity: isPreview ? .3 : .5
            }), mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
            const edgeGeometry = new THREE.BufferGeometry, edgePositions = new Float32Array(3 * proj.length + 3);
            for (let i = 0; i < proj.length; i++) edgePositions[3 * i] = proj[i].point.x, edgePositions[3 * i + 1] = proj[i].point.y, 
            edgePositions[3 * i + 2] = proj[i].point.z;
            edgePositions[3 * proj.length] = proj[0].point.x, edgePositions[3 * proj.length + 1] = proj[0].point.y, 
            edgePositions[3 * proj.length + 2] = proj[0].point.z, edgeGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
            const edgesLine = new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({
                color: "#006400",
                linewidth: 2
            }));
            return this.scene.add(edgesLine), {
                mesh: mesh,
                edges: edgesLine,
                points: proj.map(p => p.point.clone())
            };
        }
        return null;
    }
    getFigureEdges() {
        if (!this.edgesGeometry) return [];
        const position = this.edgesGeometry.getAttribute("position"), index = this.edgesGeometry.index, edges = [];
        if (index) for (let i = 0; i < index.count; i += 2) {
            const idx1 = index.array[i], idx2 = index.array[i + 1], a = (new THREE.Vector3).fromBufferAttribute(position, idx1), b = (new THREE.Vector3).fromBufferAttribute(position, idx2);
            edges.push([ a, b ]);
        } else for (let i = 0; i < position.count; i += 2) {
            const a = (new THREE.Vector3).fromBufferAttribute(position, i), b = (new THREE.Vector3).fromBufferAttribute(position, i + 1);
            edges.push([ a, b ]);
        }
        return edges;
    }
    updateParams() {
        const figureType = this.currentFigureType, figure = this.figures[figureType];
        if (figure.params.forEach(param => {
            const input = document.getElementById(`param-${param.key}`);
            if (!input) return;
            const value = input.value, initialExists = Object.prototype.hasOwnProperty.call(this._initialFigureParams || {}, param.key), initialVal = initialExists ? this._initialFigureParams[param.key] : param.default;
            if (/^[a-zA-Z]+$/.test(value)) this.figureParams[param.key] = value, initialExists && String(value) !== String(initialVal) && (this._userModifiedParams = !0); else {
                const num = parseFloat(value), parsed = isNaN(num) ? param.default : num;
                this.figureParams[param.key] = parsed, initialExists && Number(parsed) !== Number(initialVal) && (this._userModifiedParams = !0);
            }
        }), "tetrahedron" !== figureType) {
            if ("prism" === figureType) {
                const hInput = document.getElementById("param-height"), lInput = document.getElementById("param-lateralEdge");
                if (hInput && lInput) {
                    let h = parseFloat(hInput.value) || this.figureParams.height, l = parseFloat(lInput.value) || this.figureParams.lateralEdge;
                    "right" === this.figureParams.orientation ? document.activeElement === hInput ? (l = h, 
                    lInput.value = String(l)) : document.activeElement === lInput && (h = l, hInput.value = String(h)) : l < h && ("h" == (document.activeElement === lInput ? "l" : document.activeElement === hInput ? "h" : "") ? (l = h, 
                    lInput.value = String(l)) : (h = l, hInput.value = String(h))), this.figureParams.height = h, 
                    this.figureParams.lateralEdge = l;
                }
            }
            if ("pyramid" === figureType) {
                const sInput = document.getElementById("param-sides");
                if (sInput) {
                    const s = Math.max(3, parseInt(sInput.value) || this.figureParams.sides);
                    s !== this.figureParams.sides && (this.figureParams.sides = s, sInput.value = String(s));
                }
                const hInput = document.getElementById("param-height");
                if (hInput) {
                    const h = Math.max(.01, parseFloat(hInput.value) || this.figureParams.height);
                    h !== this.figureParams.height && (this.figureParams.height = h, hInput.value = String(h));
                }
                const changedSides = !1;
                if ("regular" === this.figureParams.type) {
                    const activeId = document.activeElement && document.activeElement.id || "", sides = this.figureParams.sides || 3, r = (this.figureParams.baseEdge || 2) / (2 * Math.sin(Math.PI / sides));
                    if ("param-lateralEdge" === activeId) {
                        const l = Math.max(.01, parseFloat((document.getElementById("param-lateralEdge") || {}).value) || this.figureParams.lateralEdge || this.figureParams.height), h = Math.sqrt(Math.max(0, l * l - r * r));
                        this.figureParams.height = h;
                        const hEl = document.getElementById("param-height");
                        hEl && (hEl.value = String(h));
                    } else if ("param-height" === activeId) {
                        const h = Math.max(.01, parseFloat((document.getElementById("param-height") || {}).value) || this.figureParams.height), l = Math.sqrt(Math.max(0, r * r + h * h));
                        this.figureParams.lateralEdge = l;
                        const le = document.getElementById("param-lateralEdge");
                        le && (le.value = String(l));
                    } else if (changedSides) {
                        const h = Math.max(.01, this.figureParams.height), l = Math.sqrt(Math.max(0, r * r + h * h));
                        this.figureParams.lateralEdge = l;
                        const le = document.getElementById("param-lateralEdge");
                        le && (le.value = String(l));
                    }
                }
            }
            "parallelepiped" === figureType ? [ "AB", "AD", "AA1" ].forEach(k => this._validateAndClampParam(k)) : "cube" === figureType ? this._validateAndClampParam("edge") : "cylinder" === figureType || "cone" === figureType ? [ "radius", "height" ].forEach(k => this._validateAndClampParam(k)) : "sphere" === figureType && this._validateAndClampParam("radius");
        }
        if ("irregular" === this.figureParams.type) {
            const sides = this.figureParams.sides || 4;
            for (let i = 0; i < sides; i++) {
                const edgeKey = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % sides), input = document.getElementById(`param-${edgeKey}`);
                input && (this.figureParams[edgeKey] = parseFloat(input.value) || 2);
            }
            if ("prism" === figureType) {
                const heightInput = document.getElementById("param-height");
                if (heightInput) {
                    const newH = parseFloat(heightInput.value) || this.figureParams.height;
                    this.figureParams.height = newH;
                }
            }
            if ("pyramid" === figureType) {
                const apexLabel = this.getVertexLabel(sides), activeId = document.activeElement && document.activeElement.id || "";
                if ("regular" === this.figureParams.type) {
                    const r = (this.figureParams.baseEdge || 2) / (2 * Math.sin(Math.PI / (this.figureParams.sides || 3)));
                    if ("param-lateralEdge" === activeId) {
                        const l = Math.max(.01, this.figureParams.lateralEdge || this.figureParams.height), h = Math.sqrt(Math.max(0, l * l - r * r));
                        this.figureParams.height = h;
                        const hEl = document.getElementById("param-height");
                        hEl && (hEl.value = String(h));
                    } else if ("param-height" === activeId) {
                        const h = Math.max(.01, this.figureParams.height), l = Math.sqrt(r * r + h * h);
                        this.figureParams.lateralEdge = l;
                        const le = document.getElementById("param-lateralEdge");
                        le && (le.value = String(l));
                    }
                } else {
                    const sideLengths = [];
                    for (let i = 0; i < sides; i++) {
                        const k = this.getVertexLabel(i) + this.getVertexLabel((i + 1) % sides);
                        sideLengths.push(Math.max(.01, this.figureParams[k] || 2));
                    }
                    const base = this.buildPolygonVerticesFromSideLengths(sideLengths), baseVec = base.map(p => new THREE.Vector3(p.x, 0, p.z));
                    0;
                    for (let i = 0; i < sides; i++) {
                        const k = this.getVertexLabel(i) + apexLabel, el = document.getElementById(`param-${k}`);
                        if (el) {
                            const v = Math.max(.01, parseFloat(el.value) || this.figureParams[k] || this.figureParams.height);
                            v !== this.figureParams[k] && (this.figureParams[k] = v), String(v) !== el.value && (el.value = String(v));
                        }
                    }
                    const lateralEdgesArr = [];
                    for (let i = 0; i < sides; i++) {
                        const k = this.getVertexLabel(i) + apexLabel;
                        lateralEdgesArr.push(Math.max(.01, this.figureParams[k] || this.figureParams.height));
                    }
                    if ("param-height" === (document.activeElement && document.activeElement.id || "")) {
                        let apexXZ = this.lastApexXZ;
                        if (!apexXZ) {
                            const pre = this.solveApexFromEdges(baseVec, lateralEdgesArr, !0);
                            apexXZ = pre.ok ? {
                                x: pre.apex.x,
                                z: pre.apex.z
                            } : {
                                x: 0,
                                z: 0
                            };
                        }
                        const rArr = base.map(p => Math.hypot(apexXZ.x - p.x, apexXZ.z - p.z)), h = Math.max(.01, this.figureParams.height);
                        for (let i = 0; i < sides; i++) {
                            const k2 = this.getVertexLabel(i) + apexLabel, li = Math.sqrt(rArr[i] * rArr[i] + h * h);
                            this.figureParams[k2] = li;
                            const el = document.getElementById(`param-${k2}`);
                            el && (el.value = String(li));
                        }
                    } else {
                        if (!this.isIrregularPyramidFeasible(sideLengths, lateralEdgesArr).ok) return;
                        const solved = this.solveApexFromEdges(baseVec, lateralEdgesArr, !0);
                        if (solved.ok) {
                            const apex = solved.apex;
                            this.lastApexXZ = {
                                x: apex.x,
                                z: apex.z
                            }, this.figureParams.height = apex.y;
                            const hEl = document.getElementById("param-height");
                            hEl && (hEl.value = String(apex.y));
                        }
                    }
                }
            }
        }
        const updatedGeometry = figure.create.bind(this)(this.figureParams);
        if (this._validateGeometry(updatedGeometry)) {
            if (this._removeFigureFromScene(), this.figureGeometry = updatedGeometry, this.figureGeometry.computeBoundingBox(), 
            this.updateVerticesAndLabels(figureType), this._centerGeometryOnGrid(this.figureGeometry), 
            this._createAndAddFigureToScene(figureType), ("pyramid" === figureType && "regular" === this.figureParams.type || "tetrahedron" === figureType || "cube" === figureType || "parallelepiped" === figureType || "prism" === figureType) && this.vertices.length > 0) {
                let minX = 1 / 0, maxX = -1 / 0, minY = 1 / 0, maxY = -1 / 0, minZ = 1 / 0, maxZ = -1 / 0;
                for (const v of this.vertices) v.x < minX && (minX = v.x), v.x > maxX && (maxX = v.x), 
                v.y < minY && (minY = v.y), v.y > maxY && (maxY = v.y), v.z < minZ && (minZ = v.z), 
                v.z > maxZ && (maxZ = v.z);
                const centerX = (maxX + minX) / 2, centerZ = (maxZ + minZ) / 2, analyticalTranslation = new THREE.Vector3(-centerX, -minY, -centerZ), translatedVertices = [];
                for (let i = 0; i < this.vertices.length; i++) {
                    const translated = this.vertices[i].clone().add(analyticalTranslation);
                    translatedVertices.push(translated), this.vertexLabels.length;
                }
                this.vertices = translatedVertices, this._geometryTranslation = analyticalTranslation;
            } else if ("pyramid" !== figureType || "regular" !== this.figureParams.type) {
                this.vertices, this.vertices = [];
                const position = this.figureGeometry.getAttribute("position");
                if (position) for (let i = 0; i < Math.min(position.count, this.vertexLabels.length); i++) {
                    const v = (new THREE.Vector3).fromBufferAttribute(position, i);
                    this.vertices.push(v), this.vertexLabels.length;
                }
            }
            if (this.initLabels(this.vertexLabelEpoch), this.figureGeometry && this.figureGeometry.boundingBox && (this._updateGridForBBox(this.figureGeometry.boundingBox), 
            this._updateCameraForBBox(this.figureGeometry.boundingBox)), !this._isParsingInstructions && this._lastInstructionsText && (this._lastInstructionsText = "", 
            this.parseAndApplyInstructions()), Array.isArray(this.sections) && this.sections.length > 0) {
                const oldSections = this.sections, oldLabelSprites = this.sectionLabelSprites || [];
                this.sections = [], this.sectionLabelSprites = [];
                const rebuildEpoch = ++this.labelBuildEpoch;
                oldSections.forEach((sec, idx) => {
                    try {
                        if (!sec || !Array.isArray(sec.planeDef) || sec.planeDef.length < 3) return;
                        sec.mesh && (this.scene.remove(sec.mesh), this._disposeMesh(sec.mesh)), sec.edges && (this.scene.remove(sec.edges), 
                        this._disposeMesh(sec.edges)), (oldLabelSprites[idx] || []).forEach(sp => {
                            this.scene.remove(sp), this._disposeSprite(sp);
                        });
                        const rebuilt = this.createSectionMesh(sec.planeDef, !1);
                        if (rebuilt) {
                            const previousPoints = Array.isArray(sec.points) ? sec.points : [], previousLabels = Array.isArray(sec.labels) ? sec.labels : [], mappedLabels = new Array(rebuilt.points.length).fill(null), assignedNewIndices = new Set;
                            for (let oi = 0; oi < previousPoints.length && oi < previousLabels.length; oi++) {
                                const oldPt = previousPoints[oi];
                                let bestJ = -1, bestD = 1 / 0;
                                for (let j = 0; j < rebuilt.points.length; j++) {
                                    if (assignedNewIndices.has(j)) continue;
                                    const d = oldPt.distanceTo(rebuilt.points[j]);
                                    d < bestD && (bestD = d, bestJ = j);
                                }
                                bestJ >= 0 && (mappedLabels[bestJ] = previousLabels[oi], assignedNewIndices.add(bestJ));
                            }
                            for (let j = 0; j < rebuilt.points.length; j++) mappedLabels[j] || (mappedLabels[j] = this.generateSectionPointLabel(mappedLabels.filter(l => l)));
                            const newSprites = [];
                            (async () => {
                                const myEpoch = rebuildEpoch;
                                for (let i = 0; i < rebuilt.points.length; i++) {
                                    if (this.labelBuildEpoch !== myEpoch) return;
                                    const text = mappedLabels[i];
                                    try {
                                        const spr = await this.createLabel(text);
                                        if (spr && this.labelBuildEpoch === myEpoch) {
                                            const dir = rebuilt.points[i].clone().normalize();
                                            spr.position.copy(rebuilt.points[i]).add(dir.multiplyScalar(.4)), this.scene.add(spr), 
                                            newSprites.push(spr);
                                        }
                                    } catch (_) {}
                                }
                            })(), this.sections.push({
                                mesh: rebuilt.mesh,
                                edges: rebuilt.edges,
                                points: rebuilt.points,
                                planeDef: sec.planeDef,
                                labels: mappedLabels
                            }), this.sectionLabelSprites.push(newSprites);
                        }
                    } catch (_) {}
                });
            }
        }
    }
    generateSectionPointLabel(usedInCurrentSection = []) {
        const letters = "EFGHIJKLMNOPQRSTUVWXYZ", isTaken = name => {
            if (usedInCurrentSection.indexOf(name) >= 0) return !0;
            if (this.vertexLabels && this.vertexLabels.indexOf(name) >= 0) return !0;
            if (this.namedPoints && this.namedPoints[name]) return !0;
            if (this.namedPointMarkers && this.namedPointMarkers[name]) return !0;
            if (this.sections && Array.isArray(this.sections)) for (const section of this.sections) if (section && Array.isArray(section.labels) && section.labels.indexOf(name) >= 0) return !0;
            return !1;
        };
        let suffix = 0;
        for (;;) {
            for (let i = 0; i < 22; i++) {
                const candidate = 0 === suffix ? letters[i] : `${letters[i]}_${suffix}`;
                if (!isTaken(candidate)) return candidate;
            }
            suffix++;
        }
    }
    onMouseClick(event) {
        if (this.isRemoving) return;
        if (this.sectionPanel && (this.sectionPanel === event.target || this.sectionPanel.contains(event.target))) return;
        this.mouse.x = (event.clientX - this.canvasSizes.left) / this.canvasSizes.width * 2 - 1, 
        this.mouse.y = -(event.clientY - this.canvasSizes.top) / this.canvasSizes.height * 2 + 1, 
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersectsLabels = this.raycaster.intersectObjects(this.labelSprites);
        if (intersectsLabels.length > 0) {
            const selectedLabel = intersectsLabels[0].object;
            if (this.activeInput) return;
            selectedLabel.visible = !1;
            const vector = selectedLabel.position.clone().project(this.camera), x2d = (.5 * vector.x + .5) * this.canvasSizes.width + this.canvasSizes.left, y2d = -(.5 * vector.y - .5) * this.canvasSizes.height + this.canvasSizes.top, input = document.createElement("input");
            input.type = "text", input.value = selectedLabel.userData.text, input.className = "absolute -translate-x-1/2 -translate-y-1/2 font-bold text-[20px] leading-none p-0 m-0 text-black bg-transparent border-none outline-none shadow-none text-center caret-black z-[10000]", 
            input.style.left = `${x2d}px`, input.style.top = `${y2d}px`, input.style.font = "bold 20px Arial";
            const updateWidth = () => {
                const measurer = document.createElement("span");
                measurer.className = "absolute -left-[9999px] whitespace-pre", measurer.style.font = input.style.font, 
                measurer.textContent = input.value || " ", document.body.appendChild(measurer);
                const w = measurer.offsetWidth + 6;
                document.body.removeChild(measurer), input.style.width = `${w}px`;
            };
            updateWidth(), input.addEventListener("input", updateWidth), document.body.appendChild(input), 
            input.focus(), this.activeInput = input, input.addEventListener("keydown", async e => {
                if ("Enter" === e.key && !this.isRemoving) {
                    this.isRemoving = !0;
                    const newName = input.value.trim();
                    if (newName) try {
                        const newSprite = await this.createLabel(newName);
                        newSprite.position.copy(selectedLabel.position), this.scene.remove(selectedLabel);
                        const index = this.labelSprites.indexOf(selectedLabel);
                        this.labelSprites[index] = newSprite, this.scene.add(newSprite), this.vertexLabels[this.vertexLabels.indexOf(selectedLabel.userData.text)] = newName;
                    } catch (e) {
                        selectedLabel.visible = !0;
                    } else selectedLabel.visible = !0;
                    input.parentNode && document.body.removeChild(input), this.activeInput = null, this.isRemoving = !1;
                    const paramsDiv = document.getElementById("params");
                    paramsDiv && this.renderParams(this.figures[this.currentFigureType], paramsDiv);
                }
            }), input.addEventListener("blur", () => {
                this.isRemoving || (this.isRemoving = !0, input.parentNode && document.body.removeChild(input), 
                this.activeInput = null, this.isRemoving = !1, selectedLabel.visible = !0);
            });
        } else if (this.currentFigure || this.smoothFigures.has(this.currentFigureType) && this.figureMesh) {
            const figureType = this.currentFigureType;
            let intersectObj = this.currentFigure;
            this.smoothFigures.has(figureType) && this.figureMesh && (intersectObj = this.figureMesh);
            const intersectsFigure = this.raycaster.intersectObject(intersectObj);
            if (intersectsFigure.length > 0) {
                if (this.currentPoints.length >= 3) return void this.highlightPanelRed();
                const point = intersectsFigure[0].point;
                0 === this.currentPoints.length && (this.currentStartIndex = this.vertices.length, 
                this.showPanel()), this.currentPoints.push(point.clone());
                const marker = this.createPointMarker(point);
                this.pointMarkers.push(marker);
                const label = this.generateSectionPointLabel();
                this.vertices.push(point), this.vertexLabels.push(label), this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1, 
                this.initLabels(this.vertexLabelEpoch), this.redoStack = [], 3 === this.currentPoints.length && (this.createPreviewSection(), 
                this.updateSectionControlsState());
            }
        }
    }
    showPanel() {
        this.sectionPanel && this.sectionPanel.classList.remove("hidden"), this.updateSectionControlsState();
    }
    hidePanel() {
        this.sectionPanel && this.sectionPanel.classList.add("hidden");
    }
    updateSectionControlsState() {
        this.buttonCheck && (this.buttonCheck.disabled = 3 !== this.currentPoints.length);
    }
    highlightPanelRed() {
        this.sectionPanel && (this.sectionPanel.classList.add("border-2", "border-red-500/80"), 
        setTimeout(() => {
            this.sectionPanel && this.sectionPanel.classList.remove("border-2", "border-red-500/80");
        }, 500));
    }
    createPreviewSection() {
        this._clearPreviewSection();
        const section = this.createSectionMesh(this.currentPoints, !0);
        section && (this.previewMesh = section.mesh, this.previewEdges = section.edges, 
        this.updateSectionControlsState());
    }
    showSectionFromPlaneDef(planeDef, persist = !1, initialLabels = []) {
        const built = this.createSectionMesh(planeDef, !1);
        if (!built) return null;
        persist || (this.instructionOverlays.push(built.mesh), this.instructionOverlays.push(built.edges));
        const sectionLabels = [], named = this.namedPoints || {}, figureVerts = this.vertices || [], figureLabels = this.vertexLabels || [];
        for (let i = 0; i < built.points.length; i++) {
            const P = built.points[i];
            let chosen = null;
            for (const nm in named) {
                const pos = named[nm];
                if (pos && pos.distanceTo(P) <= 1e-9) {
                    chosen = nm;
                    break;
                }
            }
            if (!chosen) {
                const n = Math.min(figureVerts.length, figureLabels.length);
                for (let k = 0; k < n; k++) if (figureLabels[k] && figureVerts[k] && figureVerts[k].distanceTo(P) <= 1e-9) {
                    chosen = figureLabels[k];
                    break;
                }
            }
            !chosen && initialLabels && initialLabels[i] && (chosen = initialLabels[i]), chosen || (chosen = this.generateSectionPointLabel(sectionLabels)), 
            sectionLabels.push(chosen);
        }
        if (persist) {
            const labelSprites = [];
            (async () => {
                for (let i = 0; i < built.points.length; i++) {
                    const text = sectionLabels[i];
                    if (!(this.namedPoints && this.namedPoints[text] || this.namedPointLabels && this.namedPointLabels[text])) try {
                        const sprite = await this.createLabel(text);
                        if (sprite) {
                            const dir = built.points[i].clone().normalize();
                            sprite.position.copy(built.points[i]).add(dir.multiplyScalar(.4)), this.scene.add(sprite), 
                            labelSprites.push(sprite);
                        }
                    } catch (_) {}
                }
            })(), this.sections.push({
                mesh: built.mesh,
                edges: built.edges,
                points: built.points,
                planeDef: planeDef,
                labels: sectionLabels
            }), this.sectionLabelSprites.push(labelSprites);
        } else (async () => {
            const epoch = this.instructionBuildEpoch || 0;
            for (let i = 0; i < built.points.length; i++) {
                const text = sectionLabels[i];
                if (!(this.namedPoints && this.namedPoints[text] || this.namedPointLabels && this.namedPointLabels[text] || this.instructionOverlays && this.instructionOverlays.some(o => o && o.userData && o.userData.text === text))) try {
                    const spr = await this.createLabel(text);
                    if (!spr) continue;
                    if ((this.instructionBuildEpoch || 0) !== epoch) {
                        try {
                            spr.material && spr.material.map && spr.material.map.dispose(), spr.material && spr.material.dispose(), 
                            spr.geometry && spr.geometry.dispose();
                        } catch (_) {}
                        return;
                    }
                    const dir = built.points[i].clone().normalize();
                    spr.position.copy(built.points[i]).add(dir.multiplyScalar(.4)), this.scene.add(spr), 
                    this.instructionOverlays.push(spr);
                } catch (_) {}
            }
        })();
        return {
            points: built.points,
            labels: sectionLabels
        };
    }
    confirmSection() {
        if (3 === this.currentPoints.length && this.previewMesh && this.previewEdges) {
            const planeDef = this.currentPoints.map(p => p.clone()), usedLabelsCopy = (this.vertexLabels && null != this.currentStartIndex ? this.vertexLabels.slice(this.currentStartIndex, this.currentStartIndex + this.currentPoints.length) : []).slice();
            this.scene.remove(this.previewMesh), this.scene.remove(this.previewEdges);
            for (let i = 0; i < this.currentPoints.length; i++) this.vertices.pop(), this.vertexLabels.pop();
            this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1, this.initLabels(this.vertexLabelEpoch), 
            this.showSectionFromPlaneDef(planeDef, !0, usedLabelsCopy), this.previewMesh = null, 
            this.previewEdges = null, this.clearCurrentSection();
        }
    }
    cancelSection() {
        this._clearPreviewSection();
        for (let i = 0; i < this.currentPoints.length; i++) this.vertices.pop(), this.vertexLabels.pop();
        this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1, this.initLabels(this.vertexLabelEpoch), 
        this.clearCurrentSection();
    }
    clearCurrentSection() {
        this.currentPoints = [], this.pointMarkers.forEach(marker => this.scene.remove(marker)), 
        this.pointMarkers = [], this.undoStack = [], this.redoStack = [], this.hidePanel(), 
        this.updateSectionControlsState();
    }
    undoAction() {
        if (0 === this.currentPoints.length) return;
        const lastPoint = this.currentPoints.pop(), lastMarker = this.pointMarkers.pop(), lastLabel = this.vertexLabels.pop(), lastVertex = this.vertices.pop();
        this.scene.remove(lastMarker), this.redoStack.push({
            point: lastPoint,
            marker: lastMarker,
            label: lastLabel,
            vertex: lastVertex
        }), this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1, this.initLabels(this.vertexLabelEpoch), 
        this.currentPoints.length < 3 ? this._clearPreviewSection() : this.createPreviewSection(), 
        0 === this.currentPoints.length && this.hidePanel(), this.updateSectionControlsState();
    }
    redoAction() {
        if (0 === this.redoStack.length) return;
        const {point: point, marker: marker, label: label, vertex: vertex} = this.redoStack.pop();
        this.currentPoints.push(point), this.pointMarkers.push(marker), this.scene.add(marker), 
        this.vertexLabels.push(label), this.vertices.push(vertex), this.undoStack.push({
            point: point,
            marker: marker,
            label: label,
            vertex: vertex
        }), this.vertexLabelEpoch = (this.vertexLabelEpoch || 0) + 1, this.initLabels(this.vertexLabelEpoch), 
        1 === this.currentPoints.length && this.showPanel(), 3 === this.currentPoints.length && this.createPreviewSection(), 
        this.updateSectionControlsState();
    }
    animate() {
        requestAnimationFrame(() => this.animate()), this.renderer.render(this.scene, this.camera);
    }
}

const visualizer = new FigureVisualizer;

window.visualizer = visualizer;