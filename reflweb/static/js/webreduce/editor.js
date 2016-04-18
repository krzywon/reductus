// require(d3.js, webreduce.server_api, dataflow)
// require(d3, dataflow)

webreduce.editor = webreduce.editor || {};

(function () {
	webreduce.editor.dispatch = d3.dispatch("accept");

  webreduce.guid = function() {
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;
      return v.toString(16);});
    return uuid;
  }

  webreduce.editor.create_instance = function(target_id) {
    // create an instance of the dataflow editor in
    // the html element referenced by target_id
    this._instance = new dataflow.editor();
    this._target_id = target_id;
    this._instance.data([{modules:[],wires: []}]);
    var target = d3.select("#" + target_id);
    target.call(this._instance);
  }
  webreduce.editor.handle_module_clicked = function() {
    // module group is 2 levels above module title in DOM
    webreduce.editor.dispatch.on("accept", null);
    var target = d3.select("#" + this._target_id);
    target.selectAll("div").remove();
    var module_index = d3.select(target.select(".module .selected").node().parentNode.parentNode).attr("index");
    var module_index = parseInt(module_index);
    var active_template = this._active_template;
    var active_module = this._active_template.modules[module_index];
    var module_def = this._module_defs[active_module.module];
    var input_datasets_id = (module_def.inputs[0] || {}).id;  // undefined if no inputs
    var fields = module_def.fields || [];
    
    webreduce.layout.open("east");
    var target = d3.select(".ui-layout-pane-east");
    target.selectAll("div").remove();

    var buttons_div = target.append("div")
      .classed("control-buttons", true)
      .style("position", "absolute")
      .style("bottom", "10px")
    buttons_div.append("button")
      .text("accept")
      .on("click", function() {
        webreduce.editor.accept_parameters(target, active_module);
        webreduce.editor.handle_module_clicked();
      })
    buttons_div.append("button")
      .text("clear")
      .on("click", function() {
        console.log(target, active_module);
        if (active_module.config) { delete active_module.config }
        webreduce.editor.handle_module_clicked();
      })
      
    $(buttons_div).buttonset();
    
    var input_datasets_promise = (input_datasets_id == undefined) ? new Promise(function(r,j) {r(null)}) : 
      webreduce.server_api.calc_terminal(active_template, {}, module_index, input_datasets_id, "metadata");
    
    input_datasets_promise.then(function(datasets_in) {
      fields.forEach(function(field) {
        if (webreduce.editor.make_fieldUI[field.datatype]) {
          webreduce.editor.make_fieldUI[field.datatype](field, active_template, module_index, module_def, target, datasets_in);
        }
      });
    });
  }
  
  webreduce.editor.handle_terminal_clicked = function() {
    var target = d3.select("#" + this._target_id);
    var selected = target.select(".module .selected");
    var index = parseInt(d3.select(selected.node().parentNode.parentNode).attr("index"));
    var terminal_id = selected.attr("terminal_id");
    webreduce.server_api.calc_terminal(this._active_template, {}, index, terminal_id, "metadata").then(function(result) {
      webreduce.editor._active_plot = webreduce.editor.show_plots(result);
      webreduce.editor._active_node = index;
      webreduce.editor._active_terminal = terminal_id;
    }); 
  }
  
  webreduce.editor.show_plots = function(result) {
    var instrument_id = this._instrument_id;
    var new_plotdata = webreduce.instruments[instrument_id].plot(result);
    if (new_plotdata == null) {
      return
    }
    if (new_plotdata.type == '1d') {
      this.show_plots_1d(new_plotdata);
    }
    else if (new_plotdata.type == '2d') {
      this.show_plots_2d(new_plotdata);
    }
    else if (new_plotdata.type == 'params') {
      this.show_plots_params(new_plotdata);
    }
  }
  
  webreduce.editor.show_plots_params = function(data) {
    d3.selectAll("#plotdiv").selectAll("svg, div").remove();
    d3.select("#plotdiv")
      .selectAll(".paramsDisplay")
      .data(data.params).enter()
        .append("div")
        .classed("paramsDisplay", true)
        .text(function(d) {return JSON.stringify(d)})
  }
  
  webreduce.editor.show_plots_2d = function(data) {
    var aspect_ratio = null;
    if ((((data.options || {}).fixedAspect || {}).fixAspect || null) == true) {
      aspect_ratio = ((data.options || {}).fixedAspect || {}).aspectRatio || null;
    }
    data.ztransform = "log";
    var chart = new heatChart(data);
    
    var transform = 'log';
    chart
      //.ztransform((transform == "log")? "log" : "linear")
      //.colormap(cm.get_colormap(current_instr == "NGBSANS" ? "spectral" : "jet"))
      .autoscale(false)
      .aspect_ratio(aspect_ratio)
      .dims(data.dims)
      .xlabel(data.xlabel)
      .ylabel(data.ylabel);
    d3.selectAll("#plotdiv").selectAll("svg, div").remove();
    d3.selectAll("#plotdiv").data(data.z).call(chart);
  }
  
  webreduce.editor.show_plots_1d = function(plotdata) {
    var options = {
      series: [],
      legend: {show: true, left: 150},
      axes: {xaxis: {label: "x-axis"}, yaxis: {label: "y-axis"}}
    };
    jQuery.extend(true, options, plotdata);
    options.xtransform = $("#xscale").val();
    options.ytransform = $("#yscale").val();
    options.show_errorbars = $("#show_errorbars").prop("checked");
    options.show_points = $("#show_points").prop("checked");
    options.show_line = $("#show_line").prop("checked");
    
    // create the 1d chart:
    var mychart = new xyChart(options);
    d3.selectAll("#plotdiv").selectAll("svg, div").remove();
    d3.selectAll("#plotdiv").data([options.data]).call(mychart);
    mychart.zoomRect(true);
    webreduce.callbacks.resize_center = mychart.autofit;
    
    // set up handlers for buttons and options:
    d3.selectAll("#xscale, #yscale").on("change", function() {
      var axis = d3.select(this).attr("axis") + "transform",
          transform = this.value;
      mychart[axis](transform);  
    });
    d3.selectAll("#show_errorbars, #show_points, #show_line").on("change", function() {
      var o = mychart.options();
      o[this.id] = this.checked;
      mychart.options(o).update();
    });
    d3.select("#export_data").on("click", function() {
      var filename = prompt("Export data as:", "myfile.refl");
      if (filename == null) {return} // cancelled
      var w = webreduce.editor,
        node = w._active_node,
        terminal = w._active_terminal,
        template = w._active_template;
      webreduce.server_api.calc_terminal(template, {}, node, terminal, 'export').then(function(result) {
        // add the template and target node, terminal to the header of the file:
        var header = {template: template, node: node, terminal: terminal};
        webreduce.download('#' + JSON.stringify(header) + '\n' + result.values.join('\n\n'), filename);
      });       
    });

    return mychart
  }

  webreduce.editor.accept_parameters = function(target, active_module) {
    target.selectAll("div.fields")
      .each(function(data) {
        if (!active_module.config) {active_module.config = {}};
          active_module.config[data.id] = data.value;
      });
  }
  
  webreduce.editor.make_fieldUI = {}; // generators for field datatypes
  
  webreduce.editor.make_fieldUI.fileinfo = function(field, active_template, module_index, module_def, target) {
    // this will add the div only once, even if called twice.
    target.selectAll("div#fileinfo").data([0])
      .enter()
        .append("div")
        .attr("id", "fileinfo")
    
    var active_module = active_template.modules[module_index];
    var datum = {"id": field.id, value: []},
        existing_count = 0;
    if (active_module.config && active_module.config[field.id] ) {
      existing_count = active_module.config[field.id].length;
      datum.value = active_module.config[field.id];
    }
    var radio = target.select("div#fileinfo").append("div")
      .classed("fields", true)
      .datum(datum)
    radio.append("input")
      .attr("id", field.id)
      .attr("type", "radio")
      .attr("name", "fileinfo");
    radio.append("label")
      .attr("for", field.id)
      .text(field.id + "(" + existing_count + ")");
    
    // jquery events handler for communications  
    $(radio.node()).on("fileinfo.update", function(ev, info) {
      if (radio.select("input").property("checked")) {
          radio.datum({id: field.id, value: info});
      } 
    });

    target.select("#fileinfo input").property("checked", true); // first one
    target.selectAll("div#fileinfo input")
      .on("click", null)
      .on("click", function() {
        $(".remote-filebrowser").trigger("fileinfo.update", d3.select(this).datum());
      });
    $("#fileinfo").buttonset();
    webreduce.callbacks.resize_center = webreduce.handleChecked;
    webreduce.handleChecked();    
  }
  
  webreduce.editor.make_fieldUI.index = function(field, active_template, module_index, module_def, target, datasets_in) {
    target.selectAll("div#indexlist").data([0])
      .enter()
        .append("div")
        .attr("id", "indexlist")
    
    var active_module = active_template.modules[module_index];

    var datum = {"id": field.id, value: []};
    if (active_module.config && active_module.config[field.id] ) {
      datum.value = active_module.config[field.id];
    }
    var index_div = target.select("div#indexlist").append("div")
      .classed("fields", true)
      .datum(datum)
    var index_label = index_div.append("label")
      .text(field.id);
    var display = index_label.append("div")
      .classed("value-display", true)
    display.text(JSON.stringify(datum.value));
    
    var datasets = datasets_in.values;
    // now have a list of datasets.
    datasets.forEach(function(d,i) {
      datum.value[i] = datum.value[i] || [];
    });
    webreduce.editor.show_plots(datasets);
    datum.value.forEach(function(index_list, i) {
      var series_select = d3.select(d3.selectAll("#plotdiv svg g.series")[0][i]);
      index_list.forEach(function(index, ii) {
        series_select.select(".dot:nth-of-type(" + (index+1).toFixed() + ")").classed("masked", true);
      });
    });
    d3.selectAll("#plotdiv .dot").on("click", null); // clear previous handlers
    d3.selectAll("#plotdiv svg g.series").each(function(d,i) {
      // i is index of dataset
      var series_select = d3.select(this);
      series_select.selectAll(".dot").on("click", function(dd, ii) {
        // ii is the index of the point in that dataset.
        d3.event.stopPropagation();
        d3.event.preventDefault();
        var dot = d3.select(this);          
        // manipulate data list directly:
        var index_list = datum.value[i];
        var index_index = index_list.indexOf(ii);
        if (index_index > -1) { 
          index_list.splice(index_index, 1); 
          dot.classed("masked", false); 
        }
        else {
          index_list.push(ii); 
          dot.classed("masked", true);
        }
        index_list.sort();
        // else, pull masked dot list from class:
        // (this has the advantage of always being ordered inherently)
        /*
        dot.classed("masked", !dot.classed("masked")); // toggle selection
        datum.value[i] = [];
        series_select.selectAll(".dot").each(function(ddd, iii) {if (d3.select(this).classed("masked")) {datum.value[i].push(iii)}});
        */
        index_div.datum(datum);
        display.text(JSON.stringify(datum.value));
      });
    });
  }
  
  webreduce.editor.make_fieldUI.str = function(field, active_template, module_index, module_def, target) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;
    var datum = {"id": field.id, "value": value};
    target.append("div")
      .classed("fields", true)
      .datum(datum)
      .append("label")
        .text(field.label)
        .append("input")
          .attr("type", "text")
          .attr("field_id", field.id)
          .attr("value", value)
          .on("change", function(d) { datum.value = this.value });
  }
  
  webreduce.editor.make_fieldUI.opt = function(field, active_template, module_index, module_def, target) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;
    var datum = {"id": field.id, "value": value};
    target.append("div")
      .classed("fields", true)
      .datum(datum)
      .append("label")
        .text(field.label)
        .append("select")
          .attr("field_id", field.id)
          .attr("value", value)
          .on("change", function(d) { datum.value = this.value })
          .selectAll("option").data(field.typeattr.choices)
            .enter().append("option")
            .attr("value", function(d) {return d[1]})
            .property("selected", function(d) {return d[1] == value})
            .text(function(d) {return d[0]});
  }
  
  webreduce.editor.make_fieldUI.float = function(field, active_template, module_index, module_def, target, datasets_in) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;
    var datum = {id: field.id, value: value};
    if (field.multiple) { 
      //datum.value = [datum.value]; 
      target.append("div")
        .classed("fields", true)
        .datum(datum)
        .append("label")           
          .text(field.label)
          .append("input")
            .attr("type", "text")
            .attr("field_id", field.id)
            .attr("value", JSON.stringify(datum.value))
            .on("change", function(d) { datum.value = JSON.parse(this.value) });
    } else {
      target.append("div")
        .classed("fields", true)
        .datum(datum)
        .append("label")
          .text(field.label)
          .append("input")
            .attr("type", "number")
            .attr("field_id", field.id)
            .attr("value", value)
            .on("change", function(d) { datum.value = parseFloat(this.value) });
    }
  }

  webreduce.editor.make_fieldUI.float_expand = function(field, active_template, module_index, module_def, target, datasets_in) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;
    var datum = {id: field.id, value: value};
    if (field.multiple) { 
      //datum.value = [datum.value]; 
      target.append("div")
        .classed("fields", true)
        .datum(datum)
        .append("label")           
          .text(field.label)
          .append("input")
            .attr("type", "text")
            .attr("field_id", field.id)
            .attr("value", JSON.stringify(datum.value))
            .on("change", function(d) { datum.value = JSON.parse(this.value) });
    } else {
      target.append("div")
        .classed("fields", true)
        .datum(datum)
        .selectAll("label").data(d3.range(datasets_in.values.length))
          .enter().append("label")
          .text(field.label)
          .append("input")
            .attr("type", "number")
            .attr("value", function(d,i) {return (value instanceof Array)? value[i] : value})
            .on("change", function(d,i) { 
              if (!(datum.value instanceof Array)) {
                var new_value = d3.range(datasets_in.values.length).map(function() {return datum.value})
                datum.value = new_value;
              }
              datum.value[i] = parseFloat(this.value);
            });
    }
  }
  
  webreduce.editor.make_fieldUI.int = function(field, active_template, module_index, module_def, target) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;
    var datum = {"id": field.id, "value": value};
    target.append("div")
      .classed("fields", true)
      .datum(datum)
      .append("label")
        .text(field.label)
        .append("input")
          .attr("type", "number")
          .attr("field_id", field.id)
          .attr("value", value)
          .on("change", function(d) { datum.value = parseInt(this.value) });
  }
  
  webreduce.editor.make_fieldUI.bool = function(field, active_template, module_index, module_def, target) {
    var active_module = active_template.modules[module_index];
    var value = (active_module.config && field.id in active_module.config) ? active_module.config[field.id] : field.default;   
    var datum = {"id": field.id, "value": value};
    target.append("div")
      .classed("fields", true)
      .datum(datum)
      .append("label")
        .text(field.label)
        .append("input")
          .attr("type", "checkbox")
          .attr("field_id", field.id)
          .property("checked", value)
          .on("change", function(d) { datum.value = this.checked });
  }
  
  webreduce.editor.fileinfo_update = function(fileinfo) {
    $(".remote_filebrowser").trigger("fileinfo.update", [fileinfo]);
  }

  webreduce.editor.load_instrument = function(instrument_id) {
    var editor = this;
    editor._instrument_id = instrument_id;
    return webreduce.server_api.get_instrument(instrument_id)
      .then(function(instrument_def) {
        editor._instrument_def = instrument_def;
        editor._module_defs = {};
        if ('modules' in instrument_def) {
          for (var i=0; i<instrument_def.modules.length; i++) {
            var m = instrument_def.modules[i];
            editor._module_defs[m.id] = m;
          }
        }
        // load into the editor instance
        editor._instance.module_defs(editor._module_defs);
        // pass it through:
        return instrument_def;
      })
  }
  
  webreduce.editor.switch_instrument = function(instrument_id) {
    this.load_instrument(instrument_id)
      .then(function(instrument_def) { 
          var template_names = Object.keys(instrument_def.templates);
          $("#main_menu #predefined_templates ul").empty();
          template_names.forEach(function (t,i) {
            $("#main_menu #predefined_templates ul").append($("<li />", {text: t}));
            $("#main_menu").menu("refresh");
          })
          var default_template = template_names[0];
          current_instrument = instrument_id;
          webreduce.editor.load_template(instrument_def.templates[default_template]); 
        });
  }
  
  webreduce.editor.load_template = function(template_def) {
    this._active_template = template_def;
    var target = d3.select("#" + this._target_id);
    this._instance.import(template_def);

    target.selectAll(".module").classed("draggable wireable", false);

    target.selectAll(".module .terminal").on("click", function() {
      target.selectAll(".module .selected").classed("selected", false);
      d3.select(this).classed('selected', true);
      webreduce.editor.handle_terminal_clicked();
    });
    target.selectAll(".module g.title").on("click", function() {
      target.selectAll(".module .selected").classed("selected", false);
      d3.select(this).select("rect.title").classed("selected", true);
      webreduce.editor.handle_module_clicked();
    });
  }
  
  
})();
