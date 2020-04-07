// JavaScript by Greg Farnsworth, 2019


//function to instantiate the Leaflet map
function createMap(){
    //create the map
    var map = L.map('mapid', {
        center: [40.5, -110],
        zoom: 5,
        zoomControl: false
    });

    //add OSM base tilelayer
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a><br>Data Sources: <a href="https://data.census.gov/cedsci">US Census Bureau</a>, <a href="https://en.wikipedia.org/wiki/Main_Page">Wikipedia</a><br>Code Samples: <a href="https://www.w3schools.com/js/">W3 Schools</a>, <a href="https://github.com/nickpeihl/leaflet-sidebar-v2">Sidebar</a>'
    }).addTo(map);

    var zoomHome = L.Control.zoomHome();
    zoomHome.addTo(map);
    
    var sidebar = L.control
        .sidebar({ container: "sidebar", position: "right" })
        .addTo(map)
        .open("home");
    
//    L.Control.textbox = L.Control.extend({
//		onAdd: function(map) {
//			
//		var text = L.DomUtil.create('div');
//		text.id = "info_text";
//		text.innerHTML = "<strong>Changes in House Price Indeces from 1995 - 2019</strong>"
//		return text;
//		},
//
//		onRemove: function(map) {
//			// Nothing to do here
//		}
//	});
//	L.control.textbox = function(opts) { return new L.Control.textbox(opts);}
//	L.control.textbox({ position: 'topleft' }).addTo(map);
    
    getData(map);
}


//function to retrieve the data and place it on the map
function getData(map){
    //load the data
    $.ajax("data/HPI.geojson", {
        dataType: "json",
        success: function(response){
            //create an attributes array to hold geojson data
            var attrs = processData(response);
            var attrHPI = attrs.arrHPI; 
            var attrRATE = attrs.arrRATE;
            
            //call functions to setup various map elements
            createPropSymbols(response, map, attrHPI, attrRATE);
            createSequenceControls(map, attrHPI, attrRATE);
            createLegendDensity(map, attrHPI);
            createLegend(map, attrHPI);
            updateDataInSidebar(map, attrHPI[0], attrRATE[0]);
        }
    });
}


//function to load relavant geojson data into working array
function processData(data){

    var attrArray = [];
    var rateArray = [];

    //properties of the first feature in the dataset (attribute names)
    var properties = data.features[0].properties;

    //push each attribute with HPI data into attributes array
    for (var attribute in properties){
        if (attribute.indexOf("yr") > -1){
            attrArray.push(attribute);
        }
        if (attribute.indexOf("rt") > -1){
            rateArray.push(attribute);
        }
    }
    
    return {
        arrHPI: attrArray,
        arrRATE: rateArray
    };
}


//function to add circle markers for point features to the map
function createPropSymbols(data, map, attributes, rates){
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes, rates);
        }
    }).addTo(map);
}


//function to convert point markers to circle markers to use as proportional symbols
function pointToLayer(feature, latlng, attributes, rates){

    //calculate graduated shades for circle markers based on pop density
    var rgbShade = Math.round(255 * Number(feature.properties.density)/10000);
    
    if (rgbShade >= 128) {
        hexShade = "2346A9"
    } else if (rgbShade >= 96) {
        hexShade = "4C6ABE"
    } else if (rgbShade >= 64) {
        hexShade = "768ED3"
    } else {
        hexShade = "A0B3E9"
    }

    //set marker options
    var options = {
        fillColor: "#" + hexShade,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    var attValue = Number(feature.properties[attributes[0]]);

    //set circle marker radius based on HPI value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    //create new popup for each circle marker
    var popup = new Popup(feature.properties, attributes[0], rates[0], layer, options.radius);

    //add popup to circle marker
    popup.bindToLayer();

    //event listeners to open popup on hover
    layer.on({
        mouseover: function(){
            this.openPopup();
        },
        mouseout: function(){
            this.closePopup();
        }
    });
             
    //return the circle marker layer with proportional circles & popups
    return layer;
}


//function to create the proportional symbol legend on the map
function createLegend(map, attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');
            $(container).append('House Price Index (HPI)<br>for Western US Cities<br><span id="legyear">1995</span>');
            
            //add temporal legend div to container
            $(container).append('<div id="temporal-legend">')

            //open the svg string
            var svg = '<svg id="attribute-legend">';

            //array of circle names to base loop on
            var circles = {
                max: 55,
                mean: 80,
                min: 105
            };
            
            var initext = {
                max: "All cities are indexed",
                mean: "against 1995 house",
                min: "prices (HPI = 100)."
            };

            //loop to add each circle and text to svg string for legend 
            for (var circle in circles){
                //circle string
                svg += '<circle class="legend-circle" id="' + circle + '" fill="#FFFFFF" fill-opacity="0.8" stroke="#000000" cx="60" cy="89" r="21.6885"/>';

                //text string
                svg += '<text id="' + circle + '-text" x="130" y="' + (circles[circle]-10) + '">' + initext[circle] + '</text>';
            }

            //close the svg string
            svg += "</svg>";

            //add attribute legend svg to container
            $(container).append(svg);
            
            return container;
        }
    });

    //add the legend to the map
    map.addControl(new LegendControl());
}


//function to create the graduated pop density legend on the map
function createLegendDensity(map, attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-density-container');
            $(container).append('Population Density (2018)');
            
            //add temporal legend div to container
            $(container).append('<div id="static-legend">')

            //open the svg tag
            var svg = '<svg id="density-legend">';

            //array of graduated shades to base loop on
            var shades = {
                step1: "#2346A9",
                step2: "#4C6ABE",
                step3: "#768ED3",
                step4: "#A0B3E9"
            };
            
            //layout of legend features
            var yspot = {
                step1: 220,
                step2: 150,
                step3: 80,
                step4: 10
            }
            
            //legend increment values
            var prange = {
                step1: ">5000",
                step2: "<5000",
                step3: "<4000",
                step4: "<2500"
            }
            
            //loop to add each rectangle and text to svg string
            for (var step in shades){
                //rectangle string
                svg += '<rect class="legend-square" id="' + step + '" fill="' + shades[step] + '" fill-opacity="1.0" stroke="#000000" width="70" height="40" x="' + yspot[step] + '" y="15"/>';
                
                //text string
                svg += '<text id="' + step + '-text" x="' + (yspot[step]+7) + '" y="85">'+prange[step]+'</text>';
            }

            //close svg string
            svg += '<text x="90" y="105">(pop per sq mi)</text></svg>';

            //add attribute legend svg to container
            $(container).append(svg);
            
            return container;
        }
    });

    //add the legend to the map
    map.addControl(new LegendControl());    
}


//Create new sequence controls
function createSequenceControls(map, attrHPI, attrRATE){   
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function (map) {

            var container = L.DomUtil.create('div', 'sequence-control-container');

            //create range input element (slider)
            $(container).append('<input class="range-slider" type="range">');

            //add skip buttons
            $(container).append('<input class="skip" type="image" id="reverse" src="img/SkipBackward.svg"/>');
            
            $(container).append('<input class="skip" type="image" id="forward" src="img/SkipForward.svg"/>');

            //kill any mouse event listeners on the map
            $(container).on('mousedown dblclick', function(e){
                L.DomEvent.stopPropagation(e);
            });

            return container;
        }
    });

    //add the sequence controls, then call the function to operate the listeners
    map.addControl(new SequenceControl());
    operateSequenceControls(map, attrHPI, attrRATE);
}


//function to operate sequence controls
function operateSequenceControls(map, attrHPI, attrRATE){
    //set slider attributes
    $('.range-slider').attr({
        max: 8,
        min: 0,
        value: 0,
        step: 1
    });
    
    //click listener for buttons
    $('.skip').click(function(){

        var index = $('.range-slider').val();

        //increment or decrement depending on button clicked
        if ($(this).attr('id') == 'forward'){
            index++;
            //if past the last attribute, wrap around to first attribute
            index = index > 8 ? 0 : index;
        } else if ($(this).attr('id') == 'reverse'){
            index--;
            //if past the first attribute, wrap around to last attribute
            index = index < 0 ? 8 : index;
        }

        //update slider
        $('.range-slider').val(index);
        //call functions to update map symbols, legend entries and sidebar data
        updatePropSymbols(map, attrHPI[index], attrRATE[index]);
        updateLegend(map, attrHPI[index]);
        updateDataInSidebar(map, attrHPI[index], attrRATE[index]);
    });

    //input listener for slider
    $('.range-slider').on('input', function(){
        //get the new index value
        var index = $(this).val();
        //call functions to update map symbols, legend entries and sidebar data
        updatePropSymbols(map, attrHPI[index], attrRATE[index]);
        updateLegend(map, attrHPI[index]);
        updateDataInSidebar(map, attrHPI[index]);
    });
}


//update proportional symbol legend after sequence change
function updateLegend(map, attribute){

    var year = attribute.split("yr")[1];
    $("#legyear").replaceWith('<span id="legyear">'+year+'</span>');
    
    //get the max, mean, and min values as an object
    var circleValues = getCircleValues(map, attribute);

    var initext = {
        max: "All cities are indexed",
        mean: "against 1995 house",
        min: "prices (HPI = 100)."
    };

    for (var key in circleValues){
        //get the radius
        var radius = calcPropRadius(circleValues[key]);

        $('#'+key).attr({
            cy: 111 - radius,
            r: radius
        });
        
        if (year == '1995') {
            $('#'+key+'-text').text(initext[key])
        } else {
            $('#'+key+'-text').text(Math.round(circleValues[key]) + " %")
        };
    }
    
}


//Resize proportional symbols according to new attribute values
function updatePropSymbols(map, attrHPI, attrRATE){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attrHPI]){
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attrHPI]);
            layer.setRadius(radius);

            var popup = new Popup(props, attrHPI, attrRATE, layer, radius);

            //add popup to circle marker
            popup.bindToLayer();
        }
    });
}


//Calculate the max, mean, and min values for a given attribute
function getCircleValues(map, attribute){
    //start with min at highest possible and max at lowest possible number
    var min = Infinity,
        max = -Infinity;

    map.eachLayer(function(layer){
        //get the attribute value
        if (layer.feature){
            var attributeValue = Number(layer.feature.properties[attribute]);

            //test for min
            if (attributeValue < min){
                min = attributeValue;
            }

            //test for max
            if (attributeValue > max){
                max = attributeValue;
            }
        }
    });

    //set mean
    var mean = (max + min) / 2;

    //return values as an object
    return {
        max: max,
        mean: mean,
        min: min
    };
}


//calculate the radius of each proportional symbol
function calcPropRadius(attrValue) {
    //scale factor to adjust symbol size evenly
    var scaleFactor = 188;
    //area based on attribute value and scale factor
    var area = attrValue * scaleFactor;
    //radius calculated based on area
    var radius = Math.sqrt(area/Math.PI)/3.3;

    return radius;
}


//function to create the popup for each feature from the geojson data layer
function Popup(properties, attribute, rate, layer, radius){
    this.properties = properties;
    this.attribute = attribute;
    this.layer = layer;
    this.year = attribute.split("yr")[1];
    this.HPI = this.properties[attribute];
    this.RATE = (this.properties[rate] == "0") ? "N/A" : this.properties[rate] + " %";
    this.content = ("<p><b>City:</b> " + this.properties.city + ", " + this.properties.state + "</p><p><b>HPI (" + this.year + "):</b> " + Number(this.HPI.toFixed(2)) + "</p><b>Rate of Change:</b> " + this.RATE + "</p>");

    this.bindToLayer = function(){
        this.layer.bindPopup(this.content, {
            offset: new L.Point(0,-radius)
        });
    };
}


//update the data in the informational sidebar after sequence change
function updateDataInSidebar(map, attribute, rate) {

    var year = attribute.split("yr")[1];

    $("#citytable").empty();
    $("#citytable").append("<tr id='th2'><th><b>City</b></th><th id='th1'><b>" + year + " HPI</b></th><th id='th3'><b>&Delta; %</b></th></tr>")

    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            //access feature properties
            var props = layer.feature.properties;
            var listcity = "<tr><td>" + props.city + ", " + props.state + "</td><td id='th1'>" + Number(props[attribute].toFixed(2)) + "</td><td id='th3'>" + props[rate] + "</td></tr>";
            $("#citytable").append(listcity);
        }
    });    
    sortTable();
}


//function to sort the data in the sidebar table
function sortTable(tablein) {
    var table, rows, switching, i, x, y, shouldSwitch;
    table = document.getElementById("citytable");
    switching = true;

    while (switching) {
        switching = false;
        rows = table.rows;
        for (i = 1; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            x = rows[i].getElementsByTagName("TD")[0];
            y = rows[i + 1].getElementsByTagName("TD")[0];
            if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
                shouldSwitch = true;
                break;
            }
        }
        if (shouldSwitch) {
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
}


$(document).ready(createMap);