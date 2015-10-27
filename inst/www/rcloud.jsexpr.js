(function() { function _jsexpr() {
    function bin_op_fun(f) {
        return function(frame, args, ctx) {
            var lhs = expression(frame, args[1], ctx),
                rhs = expression(frame, args[2], ctx);
            return {lambda: lhs.lambda || rhs.lambda, text: f(lhs.text, rhs.text)};
        };
    }

    function bin_op(disp) {
        return bin_op_fun(function(left, right) {
            return left + disp + right;
        });
    }

    function una_or_bin_op(disp) {
        return function(frame, args, ctx) {
            if(args.length===2) {
                var operand = expression(frame, args[1], ctx);
                return {lambda: operand.lambda, text: disp + operand.text};
            }
            else return bin_op(disp)(frame, args, ctx);
        };
    }

    function value(v) {
        return _.isString(v) ? '"' + v + '"' : v;
    }

    function comma_sep(frame, args, ctx) {
        var elems = _.map(args, function(arg) { return expression(frame, arg, ctx); });
        return {
            lambda: _.some(elems, function(e) { return e.lambda; }),
            text: _.pluck(elems, 'text').join(', ')
        };
    }

    var operators = {
        "$": bin_op('.'),
        "-": una_or_bin_op('-'),
        "+": una_or_bin_op('+'),
        "*": bin_op('*'),
        "/": bin_op('/'),
        "<": bin_op('<'),
        ">": bin_op('>'),
        "<=": bin_op('<='),
        ">=": bin_op('>='),
        "==": bin_op('==='),
        "!=": bin_op('!=='),
        "^": bin_op_fun(function(left, right) { // note: ** gets converted to ^
            return "Math.pow(" + left + ", " + right + ")";
        }),
        "c" : function(frame, args, ctx) {
            var elems = comma_sep(frame, args.slice(1), ctx);
            return {lambda: elems.lambda,
                    text: '[' + elems.text + ']'};
        },
        "[": function(frame, args, ctx) {
            var ray = expression(frame, args[1], ctx),
                sub = expression(frame, args[2], ctx);
            return {lambda: ray.lambda || sub.lambda,
                    text: ray.text + '[' + sub.text + ']'};
        },
        "if": function(frame, args, ctx) {
            var cond = expression(frame, args[1], ctx),
                then = expression(frame, args[2], ctx),
                else_ = expression(frame, args[3], ctx);
            return {lambda: cond.lambda || then.lambda || else_.lambda,
                    text: cond.text + '?' + then.text + ':' + else_.text};
        },
        "string": function(frame, args, ctx) {
            return {lambda: false, text: '"' + args[1] + '"'};
        },
        default: function(frame, args, ctx) { // parens or function application
            var fun = expression(frame, args[0], ctx),
                elems = comma_sep(frame, args.slice(1), ctx);
            return {
                lambda: elems.lambda,
                text: (fun.text==='(' ? '' : fun.text) + '(' +
                    elems.text + ')'
            };
        }
    };

    function lambda_body(frame, exprs, ctx) {
        var body = _.map(exprs, function(arg) {
            return expression(frame, arg, ctx).text;
        });
        body[body.length-1] = "return " + body[body.length-1];
        var cr = "\n", indent = Array(ctx.indent+1).join("\t");
        return indent + body.join(";" + cr + indent) + ";";
    }

    function lambda(frame, sexp, ctx) {
        ctx.indent++;
        var args = sexp[0].slice(1);
        var cr = "\n";
        var text = "(function (" + args.join() + ") {" + cr +
            lambda_body(frame, sexp.slice(1), ctx) + cr;
        ctx.indent--;
        var indent = Array(ctx.indent+1).join("\t");
        text += indent + "})";
        // what? not a lambda? no, we just don't need to wrap it as one
        // if it ends up evaluating into a lambda that's cool
        return {lambda: false, text: text};
    }

    function list(frame, sexp, ctx) {
        var lambda = false;
        ctx.indent++;
        var elems = [];
        for(var i=1; i<sexp.length; ++i) {
            var key = sexp[i][0];
            var val = expression(frame, sexp[i][1], ctx);
            elems.push(key + ': ' + val.text);
            lambda |= val.lambda;
        }
        ctx.indent--;
        return {lambda: lambda, text: '({' + elems.join(', ') + '})'};
    }

    function node(frame, sexp, ctx) {
        if($.isArray(sexp[0]) && sexp[0][0] === "func") // special case lambda expr trees
            return lambda(frame, sexp, ctx);
        else if($.isArray(sexp[0]) && !sexp[0][0] && sexp[0][1] === "list") // special case lists (?)
            return list(frame, sexp, ctx);
        var op = operators[sexp[0]] || operators.default;
        return op(frame, sexp, ctx);
    }

    function is_wdcplot_placeholder(sexp) {
        return sexp.r_attributes && sexp.r_attributes['wdcplot.placeholder'];
    }

    function special_function(sexp) {
        return is_wdcplot_placeholder(sexp) && sexp.r_attributes['wdcplot.placeholder'] === 'special' ?
            sexp[0] : undefined;
    }

    function dataframe_column(sexp) {
        return is_wdcplot_placeholder(sexp) && sexp.r_attributes['wdcplot.placeholder'] === 'column' ?
            sexp[0] : undefined;
    }

    function col_name(elem) {
        var place;
        if((place = special_function(elem)))
            return '..' + place + '..';
        else if((place = dataframe_column(elem)))
            return place;
        return null;
    }

    function col_ref(elem, field) {
        var placeholder = col_name(elem);
        if(placeholder)
            return placeholder;
        else {
            if(!_.isString(elem))
                throw field + " expects column, special, or string, got: " + elem;
            return elem;
        }
    }

    function leaf(frame, sexp, ctx) {
        if($.isPlainObject(sexp)) {
            return {lambda: false, text: JSON.stringify(sexp)};
        }
        else if(_.isArray(sexp)) {
            var place;
            if((place = special_function(sexp))) {
                switch(place) {
                case 'index': return {lambda: true, text: "frame.index(key)"};
                case 'value':
                case 'selected': return {lambda: true, text: "value"};
                case 'key': return {lambda: true, text: "key"};
                default: throw "unknown special variable " + sexp;
                }
            }
            else if((place = dataframe_column(sexp)))
                return {lambda: true, text: "frame.access('" + place + "')(key)"};
            else return {lambda: false, text: sexp};
        }
        else return {lambda: false, text: sexp};
    }

    function expression(frame, sexp, ctx) {
        // not dealing with cases where r classes are not terminals yet
        if($.isArray(sexp) && !is_wdcplot_placeholder(sexp))
            return node(frame, sexp, ctx);
        else
            return leaf(frame, sexp, ctx);
    }

    var wdcplot_expr_num = 1;

    /* a wdcplot argument may be
     - null
     - a column accessor or special variable marked with class attribute
     - an array (we assume any top-level array contains only literals)
     - a string or a number
     - otherwise we build javascript from the expression tree; if it contains
     field names identifiers, it's a lambda(key,value) else execute it immediately
     */
    function argument(frame, sexp, eval_fn) {
        if(sexp===null)
            return null;
        else if(_.isArray(sexp)) {
            // bypass eval for bare special variables and columns
            var place;
            if((place = special_function(sexp))) {
                switch(place) {
                case 'value':
                case 'index': return frame.index;
                case 'key': return function(k, v) { return k; };
                default: throw "unknown special variable " + sexp;
                }
            }
            else if((place = dataframe_column(sexp)))
                return frame.access(place);
            else if(sexp[0]==='c')
                return sexp.slice(1);
            // else we'll process as expression below
        }
        else if(_.isNumber(sexp) || _.isString(sexp))
            return sexp;
        var ctx = {indent:0};
        var js_expr = expression(frame, sexp, ctx);
        // incantation to make code show up in the debugger
        js_expr.text += "\n//@ sourceURL=wdcplot.expr." + wdcplot_expr_num++ + ".js";
        // eval in the context that client wants (to get its dependencies)
        if(js_expr.lambda) {
            return function(key,value) { return eval_fn(js_expr.text); };
        }
        else {
            return eval_fn(js_expr.text);
        }
    }

    // take an array of named or unnamed arguments and for any that are unnamed
    // at the beginning, give them the names specified in names
    // a cheap, incomplete implementation of R positional arguments
    function positionals(sexps, names) {
        var ret = [];
        if(!sexps.length)
            return ret;
        var i, names_started = false;
        if(!_.isArray(sexps[0])) {
            if(names.length < sexps.length)
                throw "ran out of positional arguments - use names";
            for(i = 0; i < sexps.length; ++i)
                ret.push([names[i], sexps[i]]);
        }
        else for(i = 0; i < sexps.length; ++i) {
            var elem = sexps[i];
            if(names_started) {
                if(!elem[0])
                    throw "all positional arguments must be first";
                ret.push(elem);
            }
            else {
                if(elem[0] !== null) {
                    names_started = true;
                    ret.push(elem);
                }
                else if(names.length-1 < i)
                    throw "ran out of positional arguments - use names";
                else ret.push([names[i], elem[1]]);
            }
        }
        return ret;
    }

    var jsexpr = {
        argument: argument,
        col_ref: col_ref,
        col_name: col_name,
        positionals: positionals
    };
    return jsexpr;
}
if(typeof define === "function" && define.amd) {
    define([], _jsexpr);
} else if(typeof module === "object" && module.exports) {
    module.exports = _jsexpr();
} else {
    this.jsexpr = _jsexpr();
}
}
)();
