# rcloud.dcplot
Dimensional charting (dc.js and crossfilter) for RCloud         

Define some aggregations and then drop in a dataframe. Get a set of linked, brushed and filtered interactive charts.

This RCloud package defines a simple domain-specific language for drawing linked
and filtered charts. The language is inspired by (but does not share vocabulary with)
[ggplot](http://ggplot2.org/), in the sense that it tries to define reasonable defaults
and infers parameters from other parameters in order to reduce boilerplate.

The charts are drawn with [dc.js](http://dc-js.github.io/dc.js/). rcloud.dcplot pushes an
R dataframe into a [crossfilter](http://crossfilter.github.io/crossfilter/) instance on the client.
An intermediate library, [dcplot.js](https://github.com/att/dcplot.js), performs the inference
and defaulting of chart parameters. 

As with all RCloud-JavaScript packages, [rserve.js](https://github.com/att/rserve-js) performs the translation from R to
JavaScript data structures. In this package, even some R *expressions* are sent over the
[Rserve wire](http://www.rforge.net/Rserve/dev.html), allowing the front end to generate JavaScript
functions from the R parse tree.

This is sometimes a great idea and sometimes just weird.
