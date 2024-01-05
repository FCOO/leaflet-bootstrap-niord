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
	var ns = window.Niord,
        niordOptions = ns.options;

    //Extend Niord.options with leafletPopup = dimentions for leaflet popup
    niordOptions.leafletPopup = {
        fixable  : true,
        maxHeight: 260,
        width    : 260,
        clickable: true,
        extended : {
            maxHeight: 600,
            width    : 320,
            footer   : true
        }
    };

    //Extend Niord.options with domainOnlyHover = [domain-id] of boolean. If true => polygon only 'visible' on hover
    niordOptions.domainOnlyHover = {};

    function featureMessage( feature ){ return feature.properties.niordMessage; }

    function featureType( feature ){ return feature.geometry.type; }
    function featureTypeIsLine( feature ){ return featureType( feature ) == 'LineString';  }
    function featureTypeIsPolygon( feature ){ return featureType( feature ) == 'Polygon';  }
    function featureTypeIsPoint( feature ){ return featureType( feature ) == 'Point';  }

    function latLngAsText( latLng, baseOptions, vfFormatOptions ){
        var result = $.extend({}, baseOptions || {}),
            vfFormatId = niordOptions.vfFormatId.latLng;
        vfFormatOptions = vfFormatOptions || {separator: '<br>'};

        if (vfFormatId){
            result.vfFormat  = vfFormatId;
            result.vfValue   = latLng;
            result.vfOptions = vfFormatOptions;
        }
        else
            result.text = latLng.format(vfFormatOptions);

        //iF Niord.options.onClickCoordinate = function( is given => add onClick to call it
        if (window.Niord.options.onClickCoordinate){
            result.link = lbn_onClickCoordinate;
            //Craete data-coord_id as in jquery-bootstrap-niord
            result.textData = {'coord_id': latLng.lng+' '+latLng.lat};
        }

        return result;
    }

    function lbn_onClickCoordinate(){ ns.__onClickCoordinate__(this); }

    function featureAddContextmenu(element, feature){
        var message = featureMessage( feature );

        element
            .addContextmenuItems([
                message.bsHeaderOptions('SMALL'),
                {
                    icon : 'fa-window-maximize',
                    text : {da:'Vis...', en:'Show...'},
                    width: 120,
                    onClick: $.proxy(message.asModal, message)
                }
            ])
            .setContextmenuParent(message.messages);
    }

    /***********************************************************************************************
    L.GeoJSON.Niord(options) Create a geoJSONLayer
    options
        message  : Niord.Message (optional). Only add geometry from message
        messageId: string (optional).        Only add geometry from Message with id == messageId
        domain   : string (default = '').    Domain(s) of message to add. Eq. "nw" or "fa fe"
    ***********************************************************************************************/
    L.GeoJSON.Niord = L.GeoJSON.extend({
    //Default options
        options: {
            mode: 0,
            addInteractive: true,
            transparent   : true,
            messages      : null,
            domain        : null,
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

            //Get or create Messages
            this.messages = options.messages;

            if (!this.messages){
                ns.load(options.domain ? {domains: options.domain} : {});
                this.messages = ns.messages;
            }

            //Load and add geoJSON-data
            var resolve = $.proxy(this.addMessageList, this);

            if (this.options.messageId)
                this.messages.getMessage( this.options.messageId, resolve );
            else
                if (this.options.message)
                    this.addMessageList( [this.options.message] );
                else {
                    //Load all or specified domains
                    this.messages.getMessages( this.options.domain, resolve );
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
                    latLngAsText(latLng, {textClass: 'text-nowrap  text-center d-block font-monospace'})
                );

                return {
                    width  : tooltip ? 120 : 100,
                    content: result
                };
            }
            else {
                const message = featureMessage(feature),
                      messages = message.messages;

                //Create button-list fotr popup = "Show more" and "Show all"
                message._popupButtons = message._popupButtons || [
                    {
                        id     : 'showMore',
                        icon   : 'fal fa-window-maximize',
                        text   : {da: 'Vis mere', en:'Show more'},
                        class  : 'min-width-8em',
                        onClick: message.asModal.bind(message)
                    },
                    $.extend(true, messages._showAllButtonOptions(), {class  : 'min-width-8em'})
                ];

                return $.extend(true,
                    featureMessage(feature).bsModalSmallOptions(),
                    niordOptions.leafletPopup,
                    {
                        buttons: message._popupButtons,
                        footer : niordOptions.modalSmallFooter
                    }
                );
            }

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

            if (featureTypeIsPolygon(feature) && !this.options.mode && niordOptions.domainOnlyHover[domainId]){
                result.borderColorName = 'none';
                result.onlyShowOnHover = true;
            }

            return result;
        },

        /********************************************************
        filter
        Return true/false to set whether a point is displayed or not
        depending on the mode (SMALL, NORMAL or FULL)
        ********************************************************/
        filter: function (feature/*, layer*/) {
            var typeIsPoint = featureTypeIsPoint(feature);
            switch (this.options.mode){
                case ns.mmmFull  :
                case ns.mmmNormal:
                    return true;

                case ns.mmmSmall:
                    //Do not show points in lines when displayed in small mode
                    return !feature.properties.isLinePoint;

                default:
                    //Do not show points for domains fa and fe
                    return !typeIsPoint || ($.inArray(featureMessage(feature).domainId, ['fa', 'fe']) == -1);
            }
        },

        /********************************************************
        pointToLayer
        Create a marker for the point
        The size of the marker is given by the mode and single or line point:
        Mode    Single points                                       Points in (poly)line
        -----   -------------------------------------               --------------------------------------
        FULL  : size = 'normal' with number and fixed tooltips      size = 'normal' with number
        NORMAL: size = 'normal' with number                         size = 'small'
        SMALL : size = "small"                                      Not displayed

        ********************************************************/
        pointToLayer: function (feature, latlng) {
            var inModal       = !!this.options.mode,
                pathClassName = 'niord-' + featureMessage(feature).domainId,
                size,
                iconSize = {width: 1, height: 1};

            //Defines icon-size
            switch (this.options.mode){
                case ns.mmmFull  : size = 'normal'; break;
                case ns.mmmNormal: size = feature.properties.isLinePoint ? 'small' : 'normal'; break;
                case ns.mmmSmall : size = 'small'; break;
                default          : size = 'small';
            }

            //Special case: Adjust icon-size in full no-touch mode
            if ((this.options.mode == ns.mmmFull) && !window.bsIsTouch){
                iconSize = {width: 20/24, height: 20/24};
            }

            var markerOptions = {
                    size            : size,
                    iconSize        : iconSize,
                    colorName       : pathClassName,
                    borderColorName : pathClassName,
                    number          : size == 'normal' ? feature.properties.coordIndex : undefined,
                    transparent     : !inModal,
                    hover           : true,
                    puls            : false,
                    interactive     : true,
                    tooltip                 : this._tooltip(feature),
                    tooltipPermanent        : this.options.mode == ns.mmmFull,
                    tooltipHideWhenDragging : true,
                    tooltipHideWhenPopupOpen: true,

                    shadowWhenPopupOpen  : true
                };
            if (this.options.markerPane)
                markerOptions.pane = this.options.markerPane;

            var result = markerOptions.number ? L.bsMarkerCircle(latlng, markerOptions) : L.bsMarkerSimpleRound(latlng, markerOptions);

            //Add popup
            var popupOptions = this._popup(feature);
            result.bindPopup( popupOptions );

            return result;
        },

        /********************************************************
        onEachFeature
        ********************************************************/
        onEachFeature: function (feature, layer){
            //Add contextmenu
            featureAddContextmenu( layer, feature );

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
                    nm: 0.4,
                    nw: 0.3,
                    fa: 0.2,
                    fe: 0.1
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

