# rcloud.dcplot
Dimensional charting (dc.js) for RCloud

This RCloud package defines a simple domain-specific language for drawing linked
and filtered charts. The language is inspired by (but does not share vocabulary with)
[ggplot](http://ggplot2.org/), in the sense that it tries to define reasonable defaults
and inferences for its parameters in order to reduce boilerplate.

The charts are drawn with [dc.js](http://dc-js.github.io/dc.js/). rcloud.dcplot pulls an
R dataframe into a [crossfilter](http://crossfilter.github.io/crossfilter/) instance.
An intermediate library, [dcplot.js](https://github.com/att/dcplot.js), performs the inference
and defaulting of chart parameters. As with all RCloud-JavaScript packages, [rserve.js](https://github.com/att/rserve-js) performs the magic translation from R to
JavaScript data structures. 

rcloud.dcplot is the only known package which uses [Rserve](http://www.rforge.net/Rserve/dev.html)'s
ability to send R *expressions* across the wire. This makes it possible to generate JavaScript
accessor functions from R code.
