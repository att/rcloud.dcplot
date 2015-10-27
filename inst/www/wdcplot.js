// generates dcplot chart descriptions from an EDSL in R
//////////////////////////////////////////////////////////////////////////////
(function() { function _wdcplot(dcplot, dataframe, dc, jsexpr) {
    var chart_group = 0;
    // initialize a global namespace for chart groups and their crossfilter stuff
    window.wdcplot_registry = window.wdcplot_registry || {};
    window.wdcplot_current = null;

    function dcplot_eval(text) {
        return eval(text);
    }
    
    function chart_group_name(group_no) {
        return 'dcplotgroup' + group_no;
    }

    function constant_fn(arg) {
        return function (a) { return arg; };
    }

    // are these recursive or is this top-level catch enough?
    function group_constructor(frame, sexp) {
        switch(sexp[0]) {
        case 'bin': return dcplot.group.bin(sexp[1]);
        case 'identity': return dcplot.group.identity;
        default: return jsexpr.argument(frame, sexp, dcplot_eval); // but it's operating on keys?
        }
    }

    function reduce_constructor(frame, sexp, weight) {
        var w = weight;
        var fname = sexp[0];
        if(_.isArray(sexp)) {
            if(sexp[2] !== undefined) w = sexp[2];
            if(sexp[0] === 'count' && sexp[1] !== undefined) w = sexp[1];
        }
        else fname = sexp;

        var wacc = (w === undefined) ? undefined: jsexpr.argument(frame, w, dcplot_eval);
        if(_.isNumber(wacc)) wacc = constant_fn(wacc);

        switch(fname) {
        case 'count': return (w === undefined) ? dcplot.reduce.count : dcplot.reduce.sum(wacc);
        case 'sum': return dcplot.reduce.sum(jsexpr.argument(frame, sexp[1], dcplot_eval),wacc);
        case 'any': return dcplot.reduce.any(jsexpr.argument(frame, sexp[1], dcplot_eval));
        case 'avg': return dcplot.reduce.avg(jsexpr.argument(frame, sexp[1], dcplot_eval),wacc);
        default: return jsexpr.argument(frame, sexp, dcplot_eval);
        }
    }

    function do_dimensions(frame, sexps) {
        var ret = {};
        // could almost use jsexpr.positionals() here except that you can mix named & unnamed
        for(var i = 0; i < sexps.length; ++i) {
            var elem = sexps[i], key, value;
            if(_.isArray(elem)) {
                var placeholder = jsexpr.col_name(elem);
                if(placeholder) {
                    key = placeholder;
                    value = elem;
                }
                else {
                    value = elem[1];
                    if(elem[0] !== null)
                        key = elem[0];
                    else throw "must specify dimension name unless expression is column or special variable (" + value.toString() + ')';
                }
            }
            else throw 'illegal dimension specification ' + elem.toString();

            ret[key] = jsexpr.argument(frame, value, dcplot_eval);
        }
        return ret;
    }

    function do_groups(frame, sexps, weight) {
        var ret = {};
        for(var i = 0; i < sexps.length; ++i) {
            var name = sexps[i][0], defn = sexps[i][1];
            if(name === "weight") continue;
            defn = jsexpr.positionals(defn, [null, 'dimension', 'group', 'reduce', 'weight']);
            if(defn[0][0] !== null)
                throw "expected a null here";
            if(defn[0][1] !== "group")
                throw "groups should use group constructor";
            var group = {};
            for(var j = 1; j < defn.length; ++j) {
                var field = defn[j][0], val;
                switch(field) {
                case 'dimension':
                    val = jsexpr.col_ref(defn[j][1], "dimension");
                    break;
                case 'group':
                    val = group_constructor(frame, defn[j][1]);
                    break;
                case 'reduce':
                    val = reduce_constructor(frame, defn[j][1], weight);
                    break;
                }
                group[field] = val;
            }
            ret[name] = group;
        }
        return ret;
    }

    function do_charts(frame, sexps) {
        var ret = {};
        for(var i = 0; i < sexps.length; ++i) {
            var val = sexps[i][1];
            // pity we can't do more positional args but dimension or group is
            // the next natural argument and we don't know which
            val = jsexpr.positionals(val, [null, 'title']);
            if(val[0][0] !== null)
                throw "expected a null here";
            var defn = {type: val[0][1]};
            defn.title = sexps[i][0]; // a default to be overridden
            for(var j = 1; j < val.length; ++j) {
                var key = val[j][0], value = val[j][1];
                switch(key) {
                case 'dimension': defn[key] = jsexpr.col_ref(value, "dimension"); // don't allow lambdas here
                    break;
                case 'group': defn[key] = jsexpr.col_ref(value, "group");
                    break;
                default:
                    defn[key] = jsexpr.argument(frame, value, dcplot_eval);
                }
            }
            var name = sexps[i][0] + '_' + chart_group + '_' + i;
            ret[name] = defn;
        }
        return ret;
    }

    function filter_controls(reset_action, description) {
        description = description || 'Current filter';
        var reset = $('<a/>',
                      {class: 'reset',
                       href: '#',
                       style: "display: none;"})
                .append("reset")
                .click(function(e) {
                        e.preventDefault();
                        reset_action();
                });
        return $('<span></span>')
            .append($('<span/>', {class: 'reset', style: 'display: none;'})
                    .append(description + ': ')
                    .append($('<span/>', {class: 'filter'})))
            .append('&nbsp;&nbsp;')
            .append(reset);
    }

    function make_chart_div(name, definition) {
        var title = definition.title;
        var table = $();
        var props = {id: name};

        if(_.has(definition,'columns')) {
            var chartname = name + "Div";
            var header = $('<tr/>', { class: 'header'});
            for(var col in definition.columns)
                header.append($('<th/>').append(definition.columns[col]));
            table = ($('<thead/>')
                .append(header));
            props['class'] = 'table table-hover';
        }

        var group_name = chart_group_name(chart_group);
        return $('<div/>',props)
            .append($('<div/>')
                    .append($('<strong/>').append(title))
                    .append('&nbsp;&nbsp;')
                    .append(filter_controls(function() {
                        window.wdcplot_registry[group_name].charts[name].filterAll();
                        dc.redrawAll(group_name);
                    })))
            .append(table);
    }

    var wdcplot = {
        field : function(rdata, k, r) {
            return rdata[k][r];
        },
        format_error: dcplot.format_error,
        filter_controls: filter_controls,
        translate: function(data) {
            var frame = dataframe.cols(data);
            // allow skipping sections (but don't allow repeated sections)
            var definition = {}, divs;
            for(var i = 1; i < arguments.length; ++i) {
                var arg = arguments[i];
                if(!arg)
                    continue;
                var section = arg[0], section_name;
                if(_.isArray(section)) {
                    if(section[0] !== null)
                        throw "unexpected named section " + section[0];
                    section_name = section[1];
                }
                else if(_.isString(section)) {
                    section_name = section;
                }
                else throw 'illegal chart section ' + section.toString();

                if(section_name in definition)
                    throw "unexpected repeated section " + section[1];

                var secdata = arg.slice(1);
                /*jshint -W083 */
                switch(section_name) {
                case 'dimensions':
                    definition.dimensions = do_dimensions(frame, secdata);
                    break;
                case 'groups':
                    var weight = _.find(secdata, function(exp) { return exp[0] === "weight"; });
                    definition.defreduce = (weight === undefined) ?
                        dcplot.reduce.count :
                        dcplot.reduce.sum(jsexpr.argument(frame, weight[1], dcplot_eval));
                    definition.groups = do_groups(frame, secdata, weight);
                    break;
                case 'charts':
                    definition.charts = do_charts(frame, secdata);
                    divs = _.map(_.keys(definition.charts),
                                 function(key) {
                                     return (definition.charts[key].div =
                                             make_chart_div(key, definition.charts[key])[0]);
                                 });
                    break;
                default: throw "unexpected section " + section[1];
                }
            }

            var divwrap = $('<div/>',{id:"chartdiv"+chart_group, style: "overflow:auto"});
            _.each(divs, function(div) { divwrap.append(div); });

            return {dataframe: frame,
                    defn: definition,
                    elem: divwrap,
                    groupname: chart_group_name(chart_group++)};
        }
    };
    return wdcplot;
}
if(typeof define === "function" && define.amd) {
    define(["dcplot", "dataframe", "dc", "jsexpr"], _wdcplot);
} else if(typeof module === "object" && module.exports) {
    module.exports = _wdcplot(dcplot, dataframe);
} else {
    this.wdcplot = _wdcplot(dcplot, dataframe);
}
}
)();
