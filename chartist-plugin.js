/* Chartist plugin to draw solid axes with arrows and axis labels */

Chartist.plugins = Chartist.plugins || {};
Chartist.plugins.ctHandshakeAxes = function(options)
{
  return function(chart) {
    chart.on("created", function(data) {
//      console.log("created!!", data);
      var xAxis = new Chartist.Svg( "path" );
      xAxis.attr({
        d:
          `M ${data.axisX.chartRect.x1} ${data.axisX.chartRect.y1}
           L ${data.axisX.chartRect.x2} ${data.axisX.chartRect.y1}
           l -8 -8
           m 8 8
           l -8 8`,
           stroke: "black",
           fill: "transparent"
      });
      xAxis.addClass("ct-my-axis");
      data.svg.append(xAxis, true);
      var xAxisLabel = new Chartist.Svg( "text" );
      xAxisLabel.text("t");
      xAxisLabel.attr({
        x: data.axisX.chartRect.x2 - 5,
        y: data.axisX.chartRect.y1 + 20,
      });
      xAxisLabel.addClass("ct-my-axis");
      data.svg.append(xAxisLabel);
      
      var yAxis = new Chartist.Svg( "path" );
      yAxis.attr({
        d:
          `M ${data.axisY.chartRect.x1} ${data.axisY.chartRect.y1}
           L ${data.axisY.chartRect.x1} ${data.axisY.chartRect.y2-12}
           l -8 8
           m 8 -8
           l 8 8`,
           stroke: "black",
           fill: "transparent"
      });
      yAxis.addClass("ct-my-axis");
      data.svg.append(yAxis, true);
      
      var yAxisLabel = new Chartist.Svg( "text" );
      yAxisLabel.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 10,
        dy: 0,
        stroke: "black",
        fill: "black"
      });
      yAxisLabel.addClass("ct-my-axis");
      var sLabel = new Chartist.Svg( "tspan", null, null, yAxisLabel, false );
      sLabel.text("S");
      sLabel.attr({
        stroke: "green",
        fill: "green"
      });
      yAxisLabel.text(",");
      var iLabel = new Chartist.Svg( "tspan", null, null, yAxisLabel, false );
      iLabel.text("I");
      iLabel.attr({
        stroke: "red",
        fill: "red"
      });
      yAxisLabel.text(",");
      var rLabel = new Chartist.Svg( "tspan", null, null, yAxisLabel, false );
      rLabel.text("R");
      rLabel.attr({
        stroke: "grey",
        fill: "grey"
      });
      data.svg.append(yAxisLabel);
    });
  }   
};


console.log( "Chartist.plugins: ", Chartist.plugins );