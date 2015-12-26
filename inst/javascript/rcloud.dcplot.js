((function() {

requirejs.config({
    "paths": {
        "wdcplot": "../../shared.R/rcloud.dcplot/wdcplot",
        "dcplot": "../../shared.R/rcloud.dcplot/dcplot",
        "dataframe": "../../shared.R/rcloud.dcplot/dataframe",
        "dc": "../../shared.R/rcloud.dcplot/dc",
        "crossfilter": "../../shared.R/rcloud.dcplot/crossfilter",
        "jsexpr": "../../shared.R/rcloud.dcplot/rcloud.jsexpr"
    },
    "shim": {
        "crossfilter": {
            deps: [],
            exports: "crossfilter"
        }
    }
});

return {
    handle_dcplot: function(data, k) {
        // we always return undefined; "return error(...)" is just syntactic sugar
        function error(message) {
            k(function() {
                return $('<div/>').append(message);
            });
        }
        // it seems to me more of this belongs in wdcplot.js - e.g. window.charts is
        // initialized and used there. there should only be stuff here to package this up.
        require(["wdcplot", "dcplot"], function(wdcplot, dcplot) {
            var charts, elem;
            try {
                charts = wdcplot.translate.apply(null,data.slice(1));
            }
            catch(e) {
                return error("Exception creating dcplot definition: " + e);
            }
            try {
                var dccharts = dcplot(charts.dataframe, charts.groupname, charts.defn);
                window.wdcplot_registry[charts.groupname] = dccharts;
                window.wdcplot_current = charts.groupname;
            }
            catch(e) {
                var message = wdcplot.format_error(e);
                return error(message);
            }
            k(function() { return charts.elem; });
            return undefined; // for the linter
        });
    }
};
})()) /*jshint -W033 */ // this is an expression not a statement
