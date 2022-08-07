const charts = [];

function setRange(minutes) {
    $("#displayrange .button").removeClass("button-primary");
    $("#b" + minutes).addClass("button-primary");
    for (const i in stonks) {
        charts[i].updateSeries([{
            name: stonks[i][0],
            data: fullData[i].slice(-(minutes / 10 + 2))
        }]);
        charts[i].updateOptions({xaxis: {range: minutes * 60000}});
    }
}

let isColorblind = false;

function toggleColorblind() {
    isColorblind = !isColorblind;
    if (isColorblind) {
        for (const i in stonks) {
            charts[i].updateOptions({
                plotOptions: {
                    candlestick: {
                        colors: {
                            upward: '#fff',
                            downward: '#000'
                        },
                        wick: {
                            useFillColor: false
                        }
                    }
                }
            });
        }
    } else {
        for (const i in stonks) {
            charts[i].updateOptions({
                plotOptions: {
                    candlestick: {
                        colors: {
                            upward: '#00b746',
                            downward: '#ef403c'
                        },
                        wick: {
                            useFillColor: true
                        }
                    }
                }
            });
        }
    }
}

const dateFormatter = function (value, timestamp, opts) {
    const d = new Date(timestamp);
    return d.getUTCHours() + ":" + (d.getUTCMinutes() < 10 ? "0" : "") + d.getUTCMinutes();
}
const baseOptions = JSON.stringify({
    series: [{}],
    chart: {
        height: 250,
        type: "candlestick",
        animations: {
            enabled: false
        },
        toolbar: {
            show: false
        },
        zoom: {
            enabled: true
        }
    },
    grid: {
        padding: {
            left: 20,
            right: 40
        }
    },
    dataLabels: {
        enabled: false
    },
    markers: {
        size: 0
    },
    xaxis: {
        type: "datetime",
        range: 43200000,
        labels: {
            format: "HH:mm"
        }
    },
    /*yaxis: {
        max: 500,
        min: 0
    },*/
    legend: {
        show: false
    },
});

for (const i in stonks) {
    const options = JSON.parse(baseOptions);
    options.series[0].name = stonks[i][0];
    options.series[0].data = fullData[i].slice(-72);
    options.xaxis.labels.formatter = dateFormatter;
    const chart = new ApexCharts(document.querySelector("#chart" + i), options);
    chart.render();
    charts.push(chart);
}

const FAIL_TIMEOUT = 1000;
const INTERVAL_OFFSET = 1000;
let lastTurn = -1;

function updateStonks() {
    $.ajax({
        url: "./latest/",
        contentType: "application/json"
    }).done(res => {
        if (Math.floor(res[0][0] / 600000) <= lastTurn) {
            if (lastTurn < 288) setTimeout(updateStonks, FAIL_TIMEOUT);
            return;
        }
        lastTurn = Math.floor(res[0][0] / 600000);
        for (const i in stonks) {
            fullData[i].push(res[i]);
            charts[i].appendData([{data: [res[i]]}]);
            const price = $("#p" + i);
            const arrow = (res[i][1] < res[i][4]) ? "⬈" : ((res[i][1] > res[i][4]) ? "⬊" : price.text()[0]);
            price.text(arrow + " " + res[i][4] + " G");
        }
        if (lastTurn < 288) setNextUpdateTimeout();
    }).fail((jqxhr, textStatus, error) => {
        setTimeout(updateStonks, FAIL_TIMEOUT);
    });
}

function setNextUpdateTimeout() {
    console.log(lastTurn, startTime + (lastTurn) * updateInterval - Date.now());
    setTimeout(updateStonks, startTime + (lastTurn) * updateInterval - Date.now() + INTERVAL_OFFSET + INTERVAL_OFFSET * Math.random());
}

setNextUpdateTimeout();