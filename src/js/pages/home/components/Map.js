import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {injectIntl} from 'react-intl';
import mapboxgl from 'mapbox-gl';
import {PROPS_PLANES, PROPS_TYPE_STYLE} from "../constants";
import './Map.scss';
import 'mapbox-gl-css';


class Map extends Component {

  static propTypes = {
    style: PROPS_TYPE_STYLE,
    planes: PROPS_PLANES,
    onMapPositionChanged: PropTypes.func,
    onPlaneSelected: PropTypes.func
  };

  computeNewPosition = (plane) => {
    //if there is only one point we can't predict its position,
    if (!plane.coordinates[1]) {
      return plane.coordinates[0].value;
    }

    const now = new Date();

    // point 0 is the newest point
    const point0 = plane.coordinates[0];
    const point1 = plane.coordinates[1];

    const deltaTime = now - Date.parse(point0.time);
    const lastDeltaTime = Date.parse(point1.time) - Date.parse(point0.time);

    const lngSpeed = (point0.value[0] - point1.value[0]) / lastDeltaTime;
    const latSpeed = (point0.value[1] - point1.value[1]) / lastDeltaTime;
    const newLng = point0.value[0] + deltaTime * lngSpeed;
    const newLat = point0.value[1] + deltaTime * latSpeed;

    return [newLng, newLat];
  };


  computeSinglePlane = (plane) => {
    let newPosition = this.computeNewPosition(plane);

    let line = [];

    const planito = plane.coordinates.slice(1, 10);
    planito.forEach((point) =>
      line.push(...point.value)
    );

    line.unshift(newPosition);
    console.log(newPosition);


    let point = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: newPosition
      },
      properties: {plane: plane._id}
    };

    let way = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: line
      },
      properties: {plane: plane}
    };

    return [point, way];
  };

  computeEstimatedPosition = () => {
    let planeData = [];
    if (this.props.planes) {
      this.props.planes.forEach((plane) =>
        planeData.push(...this.computeSinglePlane(plane)));
    }

    return {
      type: "FeatureCollection",
      features: (this.props.planes ? planeData : []
      )
    }
  };

  animateMarker = () => {
    // Update the data to a new position based on the animation timestamp.
    let planeSource = this.map.getSource('plane_source_id');
    if (planeSource) {
      planeSource.setData(this.computeEstimatedPosition());
    }
    // Request the next frame of the animation.
    requestAnimationFrame(this.animateMarker);
  };

  sendMapCoordinates = () => {
    this.props.onMapPositionChanged({
      bounds: this.map.getBounds(),
      zoom: this.map.getZoom().toFixed(2)
    });
  };

  loadMap = () => {
    // Add a source and layer displaying a point which will be animated in a circle.
    this.map.addSource('plane_source_id', {
      type: "geojson",
      data: this.computeEstimatedPosition(0)
    });

    this.map.addLayer({
      id: "plane_layer_id",
      source: "plane_source_id",
      type: "circle",
      paint: {
        "circle-radius": 5,
        "circle-color": "#007cbf"
      }
    });

    this.map.addLayer({
      id: "plane_way_layer_id",
      source: "plane_source_id",
      type: "line",
      paint: {
        "line-color": '#ed6498',
        "line-width": 5,
        "line-opacity": .8
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      }
    });

    // Start the animation.
    this.animateMarker();
  };

  mapClick = (event) => {
    const selectedLayers = this.map.queryRenderedFeatures(event.point, {layers: ['plane_layer_id']});
    if (selectedLayers[0] && selectedLayers[0].properties) {
      this.props.onPlaneSelected(JSON.parse(selectedLayers[0].properties.plane))
    }
  };

  componentDidMount() {
    this.map = new mapboxgl.Map({
      container: this.mapContainer,
      center: [2, 45],
      zoom: 5
    });

    this.map.on('dragend', this.sendMapCoordinates);
    this.map.on('load', this.loadMap);
    this.map.on('click', this.mapClick);

    this.sendMapCoordinates();
  }

  componentWillReceiveProps(newProps) {
    if (newProps.style !== this.props.style) {
      let mapstyle = newProps.style.source;
      if (!newProps.style.meta.vector) {
        mapstyle = {
          "version": 8,
          "sources": {
            "raster-tiles": {
              "type": "raster",
              "tiles": [newProps.style.source],
              "tileSize": newProps.style.meta.retina ? 512 : 256
            }
          },
          "layers": [{
            "id": newProps.style.meta.name,
            "type": "raster",
            "source": "raster-tiles",
            "minzoom": 0,
            "maxzoom": 21
          }]
        }
      }

      this.map.setStyle(mapstyle);
    }
  }

  componentWillUpdate() {
    if (this.props.planes && this.map && this.map.getSource('plane_source_id')) {
      this.map.getSource('plane_source_id').setData(
        this.computeEstimatedPosition(0)
      );
    }
  }

  render() {
    return (
      <div ref={el => this.mapContainer = el}/>
    );
  }

}


export default injectIntl(Map);




