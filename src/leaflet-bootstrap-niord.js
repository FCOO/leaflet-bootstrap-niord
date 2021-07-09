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

    //window.Niord.options.leaflet.attribute = attribute for the tile-layer of the map inside the bsModal-window
    ns.options.leaflet.attribution = '<i class="far fa-copyright"></i></i>&nbsp;<a target="_blank" href="https://www.openstreetmap.org/copyright/en">OpenStreetMap</a>';


    //window.Niord.options.leaflet.mapOptions = options for map-objects in modal-windows
    ns.options.leaflet.mapOptions = {
        zoomControl         : false,
        attributionControl  : false,    //Use bsAttributionControl instead of default attribution-control
        bsAttributionControl: true,

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


    //options for icon for popup and modal header for each domain
    ns.options.domainIcon = {};
    $.each(['fa', 'nm', 'nw', 'fe'], function(index, id){
        ns.options.domainIcon[id] = L.bsMarkerAsIcon('niord-'+id, 'niord-'+id);
    });


    /*
    On the map inside a modal window, the single points and the points in a (poly)line can be displayed in up to tree different mode with different levels of details.
    All points are bsMarkerCircle with differnet size and with or without number inside
        Mode    Single points                                       Points in (poly)line
        -----   -------------------------------------               --------------------------------------
        FULL  : size = 'normal' with number and fixed tooltips      size = 'normal' with number
        NORMAL: size = 'normal' with number                         size = 'small'
        SMALL : size = "small"                                      Not displayed
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

    //Extend Niord.Messages to include contextmenu
    $.extend(ns.Messages.prototype, L.BsContextmenu.contextmenuInclude);

    //Add default contextmenu-items to global object ns.messages
    if (ns.messages.asModal)
        ns.messages.addContextmenuItems([
            {icon: 'fa-th-list', _lineBefore: true, text: {da:'Vis alle...', en:'Show all...'}, onClick: $.proxy(ns.messages.asModal, ns.messages) },
        ]);

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
                map.setView(message.mapCenter, message.mapZoom, {animate: false, reset: true});
        });
        this.doNotUpdate = false;
    };

    ns.Message.prototype.maps_update_geojson_layer = function( newModalMapMode ){
        if (this.doNotUpdate) return;
        this.doNotUpdate = true;
        var _this = this;

        $.each(this.maps, function(id, _map){

            if (_map.niordDetailSelectList && _map.niordDetailSelectList.data('popover_radiogroup'))
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

        L.tileLayer(
            ns.options.leaflet.tileUrl,
            {attribution: ns.options.leaflet.attribution || ''}
        ).addTo(map);



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
                square    : false
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
            colorClassName       = 'fa-lbm-color-niord-'+message.domainId,
            borderColorClassName = 'fa-lbm-border-color-niord-'+message.domainId,

            largeMarkerIcon       = $.bsMarkerAsIcon( colorClassName,       borderColorClassName,  {extraClassName:'fa-lg',              partOfList: true, faClassName: mmmIcons.markerIcon  }),
            largeMarkerOnLineIcon = $.bsMarkerAsIcon( colorClassName,       borderColorClassName,  {extraClassName:'fa-lg fa-no-margin', partOfList: true, faClassName: mmmIcons.markerIcon  }),
            smallMarkerIcon       = $.bsMarkerAsIcon( colorClassName,       borderColorClassName,  {extraClassName:'fa-xs',              partOfList: true, faClassName: mmmIcons.markerIcon  }),
            smallMarkerOnLineIcon = $.bsMarkerAsIcon( colorClassName,       borderColorClassName,  {extraClassName:'fa-xs fa-no-margin', partOfList: true, faClassName: mmmIcons.markerIcon  }),
            tooltipIcon           = $.bsMarkerAsIcon( 'fa-lbm-color-white', 'fa-lbm-color-black',  {extraClassName:'',                   partOfList: true, faClassName: mmmIcons.tooltipIcon }),
            lineIcon              = $.bsMarkerAsIcon( colorClassName,       borderColorClassName,  {extraClassName:'fa-no-margin',       partOfList: true, faClassName: mmmIcons.lineIcon    });


        var list       = [],
            selectedId = message.currentModalMapMode;
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

        message.maps_update_geojson_layer( selectedId );

        //Resize the map and set view to geoJSON-objects when the outer element is resized
        $element.resize( function(){
            map.invalidateSize();
            if (map.niordMessage.geoJSONBoundsFitted)
                map.setView( map.niordMessage.mapCenter, map.niordMessage.mapZoom, {animate: false, reset: true} );
            else {
                map.fitNiordBounds();
                map.niordMessage.geoJSONBoundsFitted = true;
            }
        });
    };
}(jQuery, L, this, document));
