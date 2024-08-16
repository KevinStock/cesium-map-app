import React, { useState, useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

window.CESIUM_BASE_URL = '/cesium';

const CesiumMap = () => {
    const [currentLatLng, setCurrentLatLng] = useState(null);
    const [elevation, setElevation] = useState(null);
    const [elevationError, setElevationError] = useState(null);
    const debounceTimeout = useRef(null);

    const wmtsUrlBaseLayer = `https://127.0.0.1:51200/geoserver/gwc/service/wmts?service=WMTS&request=GetTile&version=1.1.1&layer=NOMS:BlueMarbleA&style=generic&tilematrixset=EPSG:4326&tilematrix=EPSG:4326:{z}&tilerow={y}&tilecol={x}&format=image/png`;
    const wmtsUrlOverlayLayer = `https://127.0.0.1:51200/geoserver/gwc/service/wmts?service=WMTS&request=GetTile&version=1.1.1&layer=NOMS:Airports&style=default&ENV=cycleId%3A2006%3Blength%3A0%3Brwy_width%3A0%3BtypeA%3A1%3BtypeB%3A1%3BtypeC%3A1%3BtypeD%3A1%3B&tilematrixset=EPSG:4326&tilematrix=EPSG:4326:{z}&tilerow={y}&tilecol={x}&format=image/png`;
    const elevationEndpoint = "https://127.0.0.1:51100/elevation/v1/elevation";
    const jwtToken = "your_token"; // Replace with your actual JWT token

    const fetchElevation = async (lat, lng) => {
        try {
            const url = `${elevationEndpoint}?latitude=${lat}&longitude=${lng}&unit=feet`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${jwtToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            setElevation(data.elevation);
            setElevationError(null);
        } catch (error) {
            console.error('Error fetching elevation:', error);
            setElevationError('Failed to fetch elevation data.');
            setElevation(null);
        }
    };

    const debounceFetchElevation = (lat, lng) => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(() => {
            fetchElevation(lat, lng);
        }, 500);
    };

    useEffect(() => {
        let viewer;

        try {
            // Disable default Cesium Ion access token and base layers
            Cesium.Ion.defaultAccessToken = undefined;

            viewer = new Cesium.Viewer("cesiumContainer", {
                imageryProvider: false, // Don't use the default imagery provider
                baseLayerPicker: false, // Disable base layer picker
                geocoder: false,        // Disable geocoder
                homeButton: false,      // Disable home button
                sceneModePicker: false, // Disable scene mode picker
                navigationHelpButton: false, // Disable help button
                animation: false,       // Disable animation widget
                timeline: false,        // Disable timeline
                shouldAnimate: true,
            });

            // Add the base layer from GeoServer
            const provider = new Cesium.UrlTemplateImageryProvider({
                url: wmtsUrlBaseLayer,
                layer: 'NOMS:BlueMarbleA',
                style: 'generic',
                tileMatrixSetID: 'EPSG:4326',
                tileMatrixLabels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                tilingScheme: new Cesium.GeographicTilingScheme(),
                maximumLevel: 10,
            });

            const layer = viewer.imageryLayers.addImageryProvider(provider);
            layer.alpha = 0.8;

            // Add the overlay layer from GeoServer
            const overlayLayer = new Cesium.UrlTemplateImageryProvider({
                url: wmtsUrlOverlayLayer,
                layer: 'NOMS:Airports',
                style: 'default',
                tileMatrixSetID: 'EPSG:4326',
                tileMatrixLabels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                tilingScheme: new Cesium.GeographicTilingScheme(),
                maximumLevel: 10,
            });

            viewer.imageryLayers.addImageryProvider(overlayLayer);

            // Handle mouse movement to fetch latitude, longitude, and elevation
            const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
            handler.setInputAction((movement) => {
                const cartesian = viewer.camera.pickEllipsoid(movement.endPosition);
                if (cartesian) {
                    const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
                    const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(5);
                    const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(5);
                    setCurrentLatLng({ lat: latitude, lng: longitude });
                    debounceFetchElevation(latitude, longitude);
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        } catch (error) {
            console.error('Error initializing Cesium viewer:', error);
        }

        return () => {
            if (viewer) {
                viewer.destroy();
            }
        };
    }, []);

    return (
        <div>
            <div id="cesiumContainer" style={{ width: '100%', height: '100vh' }}></div>
            {currentLatLng && (
                <div style={{
                    position: 'fixed',
                    bottom: 10,
                    left: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    boxShadow: '0px 0px 6px rgba(0, 0, 0, 0.2)',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '14px',
                    color: '#333',
                    zIndex: 1000
                }}>
                    <div>Latitude: {currentLatLng.lat}, Longitude: {currentLatLng.lng}</div>
                    {elevationError ? (
                        <div style={{ color: 'red' }}>{elevationError}</div>
                    ) : (
                        <div>Elevation: {elevation !== null ? `${elevation.toFixed(2)} feet` : 'Loading...'}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CesiumMap;
