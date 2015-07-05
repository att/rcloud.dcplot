dcplot.caps <- NULL

.onLoad <- function(libname, pkgname)
{
  f <- function(module.name, module.path) {
    path <- system.file("javascript", module.path, package="rcloud.dcplot")
    caps <- rcloud.install.js.module(module.name,
                                     paste(readLines(path), collapse='\n'))
    caps
  }
  dcplot.caps <<- f("rcloud.dcplot", "rcloud.dcplot.js")
  rcloud.install.css("/shared.R/rcloud.dcplot/dc.css")
}
