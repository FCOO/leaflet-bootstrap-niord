/****************************************************************************
    leaflet-bootstrap-niord-geojson.js,

    (c) 2018, FCOO

    https://github.com/FCOO/leaflet-bootstrap-niord
    https://github.com/FCOO

****************************************************************************/
(function ($, L, window, document, undefined) {
    "use strict";

    //Create namespace
    window.Niord = window.Niord || {};
	var ns = window.Niord;

    //Extend Niord.options with leafletPopup = dimentions for leaflet popup
    ns.options.leafletPopup = {
        fixable  : true,
        maxHeight: 260,
        width    : 260,
        extended : {
            maxHeight: 600,
            width    : 320
        }
    };

    //Extend Niord.options with domainOnlyHover = [domain-id] of boolean. If true => polygon only 'visible' on hover
    ns.options.domainOnlyHover = {};

/*


    stroke	    Boolean	true	    Whether to draw stroke along the path. Set it to false to disable borders on polygons or circles.
    color	    String	'#3388ff'	Stroke color
    weight	    Number	3	        Stroke width in pixels
    opacity	    Number	1.0	        Stroke opacity
    lineCap	    String	'round'	    A string that defines shape to be used at the end of the stroke.
    lineJoin	String	'round'	    A string that defines shape to be used at the corners of the stroke.
    dashArray	String	null	    A string that defines the stroke dash pattern. Doesn't work on Canvas-powered layers in some old browsers.
    dashOffset	String	null	    A string that defines the distance into the dash pattern to start the dash. Doesn't work on Canvas-powered layers in some old browsers.
    fill	    Boolean	depends	    Whether to fill the path with color. Set it to false to disable filling on polygons or circles.
    fillColor	String	*	        Fill color. Defaults to the value of the color option
    fillOpacity	Number	0.2	        Fill opacity.
    fillRule	String	'evenodd'	A string that defines how the inside of a shape is determined.
    bubblingMouseEvents	Boolean	true	When true, a mouse event on this path will trigger the same event on the map (unless L.DomEvent.stopPropagation is used).
    renderer	Renderer		    Use this specific instance of Renderer for this path. Takes precedence over the map's default renderer.
    className	String	null	    Custom class name set on an element. Only for SVG renderer.
*/



    function featureMessage( feature ){ return feature.properties.niordMessage; }

    function featureType( feature ){ return feature.geometry.type; }
    function featureTypeIsLine( feature ){ return featureType( feature ) == 'LineString';  }
    function featureTypeIsPolygon( feature ){ return featureType( feature ) == 'Polygon';  }
    function featureTypeIsPoint( feature ){ return featureType( feature ) == 'Point';  }

    function latLngAsText( latLng, lat, baseOptions ){
        var result = $.extend({}, baseOptions || {}),
            vfFormatId = ns.options.vfFormatId[lat ? 'lat' : 'lng'];

        if (vfFormatId){
            result.vfFormat = vfFormatId;
            result.vfValue  = latLng[lat ? 'lat' : 'lng'];
        }
        else
            result.text = lat ? latLng.formatLat() : latLng.formatLng();

        return result;
    }


    /***********************************************************************************************
    L.GeoJSON.Niord(options) Create a geoJSONLayer
    options
        message  : Niord.Message (optional). Only add geometry from message
        messageId: string (optional).        Only add geometry from Message with id == messageId
        domain   : string (default = '').    Domain(s) of message to add. Eq. "NW" or "FA FE"
    ***********************************************************************************************/
    L.GeoJSON.Niord = L.GeoJSON.extend({
    //Default options
        options: {
            mode: 0,
            addInteractive: true,
            transparent   : true,

        },

        //initialize
        initialize: function(options) {
            $.extend(options, {
                style       : $.proxy(this.style, this),
                filter      : $.proxy(this.filter, this),
                pointToLayer: $.proxy(this.pointToLayer, this),
                onEachFeature: $.proxy(this.onEachFeature, this),

                addInteractive: true,
                border        : true,
                shadowWhenPopupOpen     : true,
                tooltipHideWhenPopupOpen: true
            });

            L.GeoJSON.prototype.initialize.call(this, null, options);

            this.on('add', this._updateZIndex, this );

            //Load and add geoJSON-data
            var resolve = $.proxy(this.addMessageList, this);
            if (this.options.messageId)
                ns.messages.getMessage( this.options.messageId, resolve );
            else
                if (this.options.message)
                    this.addMessageList( [this.options.message] );
                else {
                    //Load all or specified domains
                    ns.getMessages( this.options.domain, resolve );
                }

        },

        _updateZIndex: function(){
            this.eachLayer( function(layer){
                if (layer.setZIndexOffset){
                    layer.setZIndexOffset( layer.feature.properties.zIndex );
                }
            });

            return this;
        },

        _tooltip: function(feature){
            return  !this.options.mode ?
                        featureMessage( feature ).popoverContent() :
                        feature.properties['name'] ?
                            feature.properties['name'] :
                            feature.properties['nameList'] ?
                                feature.properties['nameList'][0] :
                                null;
        },

        _popup: function(feature){
            if (this.options.mode){
                var result  = [],
                    tooltip = this._tooltip(feature);
                if (tooltip)
                    result.push(
                        {text: tooltip, textClass: 'text-center d-block'},
                        '<hr>'
                    );

                var latLng = L.GeoJSON.coordsToLatLng(feature.geometry.coordinates);
                result.push(
                    latLngAsText(latLng, true,  {textClass: 'text-nowrap  text-center d-block text-monospace'}),
                    latLngAsText(latLng, false, {textClass: 'text-nowrap  text-center d-block text-monospace'})
                );

                return {
                    width  : tooltip ? 120 : 100,
                    content: result,
                    extended: {
                        content: result  //Include extended to work in extended modal windows
                    }
                };
            }
            else
                return $.extend(true, featureMessage(feature).bsModalSmallOptions(), ns.options.leafletPopup);

        },

        /********************************************************
        style
        ********************************************************/
        style: function( feature ){
            var domainId        = featureMessage(feature).domainId,
                domainColorName = 'niord-' + domainId, //Domain-style
                result = {
                    borderColorName: domainColorName,
                    hover          : false,
                };


            if (this.options.mode)
                //Inactive lines and polygon in modal windows
                result.interactive = false;
            else
                //hover-effect on main map
                result.hover = true;

            if (featureTypeIsPolygon(feature))
                result.colorName = domainColorName;

            if (featureTypeIsPolygon(feature) && !this.options.mode && ns.options.domainOnlyHover[domainId]){
                result.borderColorName = 'none';
                result.onlyShowOnHover = true;
            }

            return result;


//HER             var classNames = [];
//HER
//HER             classNames.push(
//HER                 'niord',                                       //Default
//HER                 'niord-' + featureMessage(feature).domainId    //Domain-style
//HER             );
//HER
//HER             if (this.options.mode)
//HER                 classNames.push('niord-inactive');
//HER
//HER             if (featureTypeIsLine(feature))
//HER                 classNames.push('niord-no-fill');
//HER
//HER             if (featureTypeIsPolygon(feature) && !this.options.mode && ns.options.domainOnlyHover[featureMessage( feature ).domainId])
//HER                 classNames.push('niord-only-hover');
//HER
//HER             return { className: classNames.join(' ') };
        },

        /********************************************************
        filter
        ********************************************************/
        filter: function (feature/*, layer*/) {
            var typeIsPoint = featureTypeIsPoint(feature);
            switch (this.options.mode){
                case ns.mmmFull  :
                case ns.mmmNormal:
                    return true;

                case ns.mmmSmall:
                    return !feature.properties.isLinePoint;

                default:
                    //Do not show points for domains FA and FE
                    return !typeIsPoint || ($.inArray(featureMessage(feature).domainId, ['FA', 'FE']) == -1);
            }
        },

        /********************************************************
        pointToLayer
        ********************************************************/
        pointToLayer: function (feature, latlng) {
            var inModal       = !!this.options.mode,
                pathClassName = 'niord-' + featureMessage(feature).domainId,
                iconSize;

            //Defines icon-size
            switch (this.options.mode){
                case ns.mmmFull  : iconSize = 1; break;
                case ns.mmmNormal: iconSize = !feature.properties.isLinePoint ? 1 : 0; break;
                case ns.mmmSmall : iconSize = 0; break;
                default          : iconSize = 0;
            }
            if (iconSize && window.bsIsTouch)
                iconSize = 2;

            var result = L.bsMarker(latlng, {
                            draggable       : false,
                            colorName       : pathClassName,
                            borderColorName : pathClassName,
                            useBigIcon      : false,
                            iconSize        : iconSize,
                            number          : iconSize ? feature.properties.coordIndex : undefined,
                            transparent     : !inModal,
                            hover           : true,
                            puls            : false,
                            bigIconWhenTouch: true,
                            interactive     : true,
                            tooltip                 : this._tooltip(feature),
                            tooltipPermanent        : this.options.mode == ns.mmmFull,
                            tooltipHideWhenDragging : true,
                            tooltipHideWhenPopupOpen: true,

                            shadowWhenPopupOpen  : true

                    });

            //Add popup. Bug fix: Since the large map is displayed in modal extended mode the popup content is set to be extended
            var popupOptions = this._popup(feature);
            popupOptions.isExtended = !!this.options.insideExtendedModal;
            result.bindPopup( popupOptions );

            return result;
        },

        /********************************************************
        onEachFeature
        ********************************************************/
        onEachFeature: function (feature, layer){
            if (!featureTypeIsPoint(feature) && !this.options.mode){
                layer.bindPopup( this._popup(feature) );
                layer.bindTooltip( this._tooltip(feature), {sticky: true} );
            }
        },

        /********************************************************
        addMessageList
        ********************************************************/
        addMessageList: function(messageList){
            var geoJSONList = [];

            //************************************************
            function processLineString( fea, coordinates ){
                var hasCoordIndex = $.type(fea.properties.startCoordIndex) == 'number',
                    startCoordIndex = fea.properties.startCoordIndex;
                $.each( coordinates, function( coorIndex, coor ){
                    var newFeature = {
                            type: "Feature",
                            geometry: {
                                type: "Point",
                                coordinates: $.extend({}, coor)
                            },
                            properties: {
                                    isLinePoint : true,
                                    niordMessage: fea.properties.niordMessage
                            }
                        };
                    //Set coordIndex and get name from nameList (if any)
                    if (hasCoordIndex){
                        newFeature.properties.coordIndex = startCoordIndex + coorIndex;

                        var nameIndex = newFeature.properties.coordIndex - fea.properties.startCoordIndex;
                        newFeature.properties.name = fea.properties.nameList ? fea.properties.nameList[nameIndex] || '' : '';
                    }
                    geoJSONList.push( newFeature );
                });
            }
            //************************************************

            messageList = $.isArray(messageList) ? messageList : [messageList];

            //Find all geoJSON from the messages in messageList
            $.each(messageList, function(index, mess ){
                if (mess.geoJSON)
                    geoJSONList.push(mess.geoJSON);
            });

            var geoJSON = window.GeoJSON.merge(geoJSONList);

            if (this.options.mode){
                $.each( geoJSON.features, function( index, feature ){
                    //Add all coordinates in Polygon and LineString as Point and set properties.isLinePoint = true
                    if (featureTypeIsLine(feature))
                        processLineString( feature, feature.geometry.coordinates );
                    else
                        if (featureTypeIsPolygon(feature))
                            //Polygon => coordinates = array og LineString-coordinates
                            $.each( feature.geometry.coordinates, function( coorIndex, coor ){
                                processLineString( feature, coor );
                            });
                });
            }


            geoJSON = window.GeoJSON.merge(geoJSONList);

            //Set sortValue to each geoJSON to sort by "size" to put points before lines before polylines before small polygons before large polygons
            //Set zIndex to each Point to put points from LineString or Polygon behind 'real' points
            var geometryTypeSortValue = {
                    Point           : 100,
                    MultiPoint      : 300,
                    LineString      : 400,
                    MultiLineString : 500,
                    Polygon         : 999,
                    MultiPolygon    : 999
                },
                domainIdSortValue = {
                    NM: 0.4,
                    NW: 0.3,
                    FA: 0.2,
                    FE: 0.1
                };


            $.each( geoJSON.features, function( index, feature ){
                var sortValue = geometryTypeSortValue[feature.geometry.type],
                    zIndex    = 0;
                if (featureTypeIsPoint(feature)){
                    if (feature.properties.isLinePoint)
                        sortValue = 200;
                    sortValue = sortValue + (feature.properties.coordIndex ? feature.properties.coordIndex : 0);

                    zIndex = 400 - sortValue;
                }

                if (featureTypeIsPolygon(feature)){
                    var bound;
                    L.geoJSON(feature, {onEachFeature: function (f, layer){ bound = layer.getBounds(); }});
                    sortValue = sortValue +
                                    1000*( Math.abs(bound._northEast.lat - bound._southWest.lat) * Math.abs(bound._northEast.lng - bound._southWest.lng) ) +
                                    domainIdSortValue[ featureMessage(feature).domainId ];
                }

                feature.properties.sortValue = sortValue;
                feature.properties.zIndex = zIndex;
            });

            geoJSON.features.sort( function( f1,f2 ){ return f2.properties.sortValue - f1.properties.sortValue; });

            this.addData(geoJSON);

        },
    });

    return L.GeoJSON.Niord;

}(jQuery, L, this, document));


;
/****************************************************************************
    leaflet-bootstrap-niord.js,

    (c) 2018, FCOO

    https://github.com/FCOO/leaflet-bootstrap-niord
    https://github.com/FCOO

****************************************************************************/
(function ($, L, window, document, undefined) {
    "use strict";

    //Create namespace
    window.Niord = window.Niord || {};
	var ns = window.Niord;

    //Extend window.Niord.options with leaflet = options for different leaflet objects
    ns.options.leaflet = ns.options.leaflet || {};

    //window.Niord.options.leaflet.tileUrl = url for the tile-layer of the map inside the bsModal-window
    ns.options.leaflet.tileUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    //window.Niord.options.leaflet.mapOptions = options for map-objects in modal-windows
    ns.options.leaflet.mapOptions = {
        zoomControl       : false,
        attributionControl: false,

        closePopupOnClick   : true,	    //true	Set it to false if you don't want popups to close when user clicks the map.
        boxZoom             : false,    //true	Whether the map can be zoomed to a rectangular area specified by dragging the mouse while pressing the shift key.
        doubleClickZoom     : true,	    //true	Whether the map can be zoomed in by double clicking on it and zoomed out by double clicking while holding shift. If passed 'center', double-click zoom will zoom to the center of the view regardless of where the mouse was.
        dragging            : true,     //true	Whether the map be draggable with mouse/touch or not.
        zoomSnap            : .25,	    //1	Forces the map's zoom level to always be a multiple of this, particularly right after a fitBounds() or a pinch-zoom. By default, the zoom level snaps to the nearest integer; lower values (e.g. 0.5 or 0.1) allow for greater granularity. A value of 0 means the zoom level will not be snapped after fitBounds or a pinch-zoom.
        zoomDelta           : .25,	    //1	Controls how much the map's zoom level will change after a zoomIn(), zoomOut(), pressing + or - on the keyboard, or using the zoom controls. Values smaller than 1 (e.g. 0.5) allow for greater granularity.
        trackResize         : false,	//true	Whether the map automatically handles browser window resize to update itself.


        center  : [0,0],    //undefined	Initial geographic center of the map
        zoom    : 6,        //undefined	Initial map zoom level
        minZoom : 4,        //Minimum zoom level of the map. If not specified and at least one GridLayer or TileLayer is in the map, the lowest of their minZoom options will be used instead.
        //maxZoom	: 18        //Maximum zoom level of the map. If not specified and at least one GridLayer or TileLayer is in the map, the highest of their maxZoom options will be used instead.

    };


    /*
    The map inside a modal can display the points and (poly)lines in up to tree different mode with different levels of details :
        FULL  : All points are displayed as bsMarker size 2 and with fixed tooltips
        NORMAL: All regular Points are displayed as bsMarker size 2. LineString and Polyline Points are displayed as small dots = bsMarker size 0
        SMALL : All regular Points are displayed as bsMarker size 1. LineString and Polyline Points are not displayed.
    */

    //In Niord const are created. mmm = modalMapMode
    ns.mmmFull   = 'FULL';
    ns.mmmNormal = 'NORMAL';
    ns.mmmSmall  = 'SMALL';
    ns.mmmList   = [ns.mmmFull, ns.mmmNormal, ns.mmmSmall];

    //window.Niord.options.leaflet.mmmIcons = class-names for different icons used in select of details in modal
    ns.options.leaflet.mmmIcons = {
        markerIcon : undefined,  //Used default
        lineIcon   : 'fa-minus',
        tooltipIcon: 'fa-square' //TODO: Require font-awesome Pro
    };

    //Extend Niord.Message with function to sync different maps
    ns.Message.prototype.maps_update_center_and_zoom = function(event){
        if (this.doNotUpdate) return;
        this.doNotUpdate = true;
        var mapId   = event.target._leaflet_id,
            map     = this.maps[mapId],
            message = map.niordMessage;

        message.mapCenter = map.getCenter();
        message.mapZoom   = map.getZoom();
        $.each(this.maps, function(id, map){
            if (!map.doNotUpdate)
                map.setView(message.mapCenter, message.mapZoom);
        });
        this.doNotUpdate = false;
    };


    ns.Message.prototype.maps_update_geojson_layer = function( newModalMapMode ){
        if (this.doNotUpdate) return;
        this.doNotUpdate = true;
        var _this = this;
        $.each(this.maps, function(id, _map){

            if (_map.niordDetailSelectList)
                _map.niordDetailSelectList.data('popover_radiogroup').setSelected( newModalMapMode );

            $.each(_map.niordGeoJSONLayers, function(id, layer){ layer.remove(); } );

            _map.niordGeoJSONLayers[newModalMapMode] =
                _map.niordGeoJSONLayers[newModalMapMode] || (new L.GeoJSON.Niord({message: _this, mode: newModalMapMode, insideExtendedModal: _map.insideExtendedModal }) );
            _map.niordGeoJSONLayers[newModalMapMode].addTo(_map);

            _map.niordMessage.geoJSONBounds = _map.niordMessage.geoJSONBounds || _map.niordGeoJSONLayers[newModalMapMode].getBounds();
        });
        this.currentModalMapMode = newModalMapMode;
        this.doNotUpdate = false;
    };

    /*********************************************************************
    Sets the function to create small maps in bsModals for the different message
    *********************************************************************/
    ns.options.createMap = function($element, message, options){
        var $map = $('<div/>')
                        .css({
                            height: options && options.largeVersion ? '500px' : '300px',
                            width:'100%'
                        })
                        .appendTo($element),
            map = L.map($map.get(0), ns.options.leaflet.mapOptions);

        map.insideExtendedModal = options.largeVersion;

        L.tileLayer(ns.options.leaflet.tileUrl).addTo(map);

        //Save the map in the message and sync the maps in different modal-modes
        message.maps = message.maps || {};
        message.maps[map._leaflet_id] = map;
        map.on('moveend zoomend', message.maps_update_center_and_zoom, message );

        //Create the tree different versions of geoJSON-layer and add them
        map.niordGeoJSONLayers = {};

        //Link the map to this and save the bounds of the geoJSON-elements
        map.niordMessage = message;

        message.geoJSONBoundsFitted = false;

        message.mapCenter = ns.options.leaflet.mapOptions.center;
        message.mapZoom = ns.options.leaflet.mapOptions.zoom;

        map.fitNiordBounds = function(){
            this.fitBounds(this.niordMessage.geoJSONBounds, {maxZoom: 10} );
        };

        //Add button on map to center on geoJSON-elements
        map.addControl(
            L.control.bsButton({
                position: 'topcenter',
                icon    : 'fa-expand',
                onClick : map.fitNiordBounds,
                context : map
            })
        );

        //Add button to change the details on the map == change between the map.niordGeoJSONLayers
        var controlButton =
            L.control.bsButton({
                position  : 'topleft',
                text      : {da:'Vis...', en:'Show...'},
            });
        map.addControl(controlButton);

        //Add popover with icons for different levels of details

        //First detect witch type og geoJSON feature the message contains
        var hasPoint = false, hasLine = false, hasFixedPopup = false;
        $.each( message.geoJSON.features, function( index, feature ){
            switch (feature.geometry.type){
                case 'Point':
                    hasPoint = true;
                    if (feature.properties && (feature.properties.name || feature.properties.nameList))
                        hasFixedPopup = true;
                    break;

                case 'LineString':
                case 'Polygon'   :
                    hasLine = true;
                    break;
            }
        });

        //Create the icons for large icon, small icon, popup and line
        var mmmIcons = ns.options.leaflet.mmmIcons,
            colorClassName = 'niord-'+message.domainId,
            largeMarkerIcon       = L.bsMarkerAsIcon(colorClassName, colorClassName,  {extraClassName:'fa-lg',              partOfList: true, faClassName: mmmIcons.markerIcon  }),
            largeMarkerOnLineIcon = L.bsMarkerAsIcon(colorClassName, colorClassName,  {extraClassName:'fa-lg fa-no-margin', partOfList: true, faClassName: mmmIcons.markerIcon  }),
            smallMarkerIcon       = L.bsMarkerAsIcon(colorClassName, colorClassName,  {extraClassName:'fa-xs',              partOfList: true, faClassName: mmmIcons.markerIcon  }),
            smallMarkerOnLineIcon =  L.bsMarkerAsIcon(colorClassName, colorClassName, {extraClassName:'fa-xs fa-no-margin', partOfList: true, faClassName: mmmIcons.markerIcon  }),
            tooltipIcon           = L.bsMarkerAsIcon('white',        'black',         {extraClassName:'fa-no-margin',       partOfList: true, faClassName: mmmIcons.tooltipIcon }),
            lineIcon              = L.bsMarkerAsIcon(colorClassName, colorClassName,  {extraClassName:'fa-no-margin',       partOfList: true, faClassName: mmmIcons.lineIcon    });


        var list = [], selectedId;
        $.each( ns.mmmList, function( index, mmm ){
            var listItem = {id: mmm, icon: []};
            switch (mmm){
                case ns.mmmFull  :
                    if (hasPoint){
                        if (hasFixedPopup)
                            listItem.icon.push(tooltipIcon);
                        listItem.icon.push(largeMarkerIcon);
                    }
                    if (hasLine)
                        listItem.icon.push(lineIcon, largeMarkerOnLineIcon, lineIcon );
                    break;

                case ns.mmmNormal:
                    if (hasFixedPopup || hasLine){
                        if (hasPoint)
                            listItem.icon.push(largeMarkerIcon);
                        if (hasLine)
                            listItem.icon.push(lineIcon, smallMarkerOnLineIcon, lineIcon );
                    }
                    break;

                case ns.mmmSmall :
                    if (hasPoint)
                        listItem.icon.push(smallMarkerIcon);
                    if (hasLine)
                        listItem.icon.push(lineIcon, lineIcon, lineIcon );
                    break;
            }

            if (listItem.icon.length){
                list.push(listItem);
                selectedId = selectedId || mmm;
            }
        });


        message.maps_update_geojson_layer( selectedId );

        map.niordDetailSelectList =
            $(controlButton.getContainer())
                .bsSelectListPopover({
                    onChange: message.maps_update_geojson_layer,
                    context : message,

                    center      : true,
                    vertical    : true,
                    closeOnClick: true,
                    placement   : 'rightbottom',
                    selectedId  : selectedId,
                    list        : list
                });


        //Resize the map and set view to geoJSON-objects when the outer element is resized
        $element.resize( function(){
            map.invalidateSize();
            if (map.niordMessage.geoJSONBoundsFitted)
                map.setView( map.niordMessage.mapCenter, map.niordMessage.mapZoom );
            else {
                map.fitNiordBounds();
                map.niordMessage.geoJSONBoundsFitted = true;
            }
        });
    };
}(jQuery, L, this, document));
