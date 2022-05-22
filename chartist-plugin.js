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
      
      var yAxisLabel1 = new Chartist.Svg( "text" );
      yAxisLabel1.text("S");
      yAxisLabel1.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 10,
        dy: 0,
        stroke: "green",
        fill: "green"
      });
      yAxisLabel1.addClass("ct-my-axis");
      data.svg.append(yAxisLabel1);

      var yAxisLabel2 = new Chartist.Svg( "text" );
      yAxisLabel2.text(",");
      yAxisLabel2.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 23,
        dy: 0,
        stroke: "black",
        fill: "black"
      });
      yAxisLabel2.addClass("ct-my-axis");
      data.svg.append(yAxisLabel2);

      var yAxisLabel3 = new Chartist.Svg( "text" );
      yAxisLabel3.text("I");
      yAxisLabel3.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 30,
        dy: 0,
        stroke: "red",
        fill: "red"
      });
      yAxisLabel3.addClass("ct-my-axis");
      data.svg.append(yAxisLabel3);

      var yAxisLabel4 = new Chartist.Svg( "text" );
      yAxisLabel4.text(",");
      yAxisLabel4.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 37,
        dy: 0,
        stroke: "black",
        fill: "black"
      });
      yAxisLabel4.addClass("ct-my-axis");
      data.svg.append(yAxisLabel4);
      
      var yAxisLabel5 = new Chartist.Svg( "text" );
      yAxisLabel5.text("R");
      yAxisLabel5.attr({
        x: data.axisY.chartRect.x1,
        y: data.axisY.chartRect.y2,
        dx: 44,
        dy: 0,
        stroke: "grey",
        fill: "grey"
      });
      yAxisLabel5.addClass("ct-my-axis");
      data.svg.append(yAxisLabel5);

    });
  }   
};


console.log( "Chartist.plugins: ", Chartist.plugins );