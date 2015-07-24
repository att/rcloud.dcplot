wdcplot.special.variable <- function(name) structure(name, wdcplot.placeholder = "special")
wdcplot.column <- function(name) structure(name, wdcplot.placeholder = "column")

wdcplot.default.context <- NULL

wdcplot.substitute <- function(context, expr) {
  data <- context$data

  # make a pseudo-environment which maps columns and special variables to placeholders
  specials <- list(..index.. = wdcplot.special.variable('index'),
                   ..value.. = wdcplot.special.variable('value'),
                   ..selected.. = wdcplot.special.variable('selected'),
                   ..key.. = wdcplot.special.variable('key'))
  cols2placeholders <- Map(wdcplot.column, names(data))
  looksee <- list2env(c(cols2placeholders, specials))

  # this feint comes from pryr: make substitute work in the global environment
  parent.env <- parent.frame(2);
  if (identical(parent.env, globalenv())) {
    parent.env <- as.list(parent.env)
  }

  # substitute in this order:
  # - first evaluate anything bquoted with .(expr)
  # - then substitute in the dataframe pseudo-environment
  # - then substitute in the parent environment
  do.call(substitute,
          list(do.call(substitute,
                       list(do.call(bquote, list(expr, where = parent.env)),
                            looksee)),
               parent.env))

}

wdcplot <- function(data, dims=NULL, groups=NULL, charts=NULL) {
  context <- list(data=data)

  dims2 <- wdcplot.substitute(context, substitute(dims))
  groups2 <- wdcplot.substitute(context, substitute(groups))
  charts2 <- wdcplot.substitute(context, substitute(charts))

  deferred.rcloud.result(function() dcplot.caps$handle_dcplot(list("dcplot", data, dims2, groups2, charts2)))
}
