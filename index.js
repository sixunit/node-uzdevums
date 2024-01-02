//Niks Ostrovskis

const express = require("express");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const xml2js = require('xml2js');

const app = express();

app.use(express.json());
app.use(xmlBodyParser()); 
app.get('/', fetchData, handleData, loggingMiddleware);

function xmlBodyParser() {
  return function (req, res, next) {
    if (req.headers['content-type'] === 'application/xml') {
      let xmlData = '';
      req.setEncoding('utf8');
      req.on('data', chunk => xmlData += chunk);
      req.on('end', () => {
        // parsē xml neveidojot root vai array
        xml2js.parseString(xmlData, { explicitArray: false, explicitRoot: false }, (err, result) => {
          if (err) {
            return sendErrorResponse(res, 400, "Invalid XML format");
          }
          req.body = result;
          next();
        });
      });
    } else {
      next();
    }
  };
}

function fetchData(req, res, next) {
  if (!req.body.query) {
    return sendErrorResponse(res, 400, "Bad request response");
  }

  const query = req.body.query;
  if (!query || query.length < 3 || query.length > 10) {
    return sendErrorResponse(res, 400, "Quary must be between 3 and 10 characters");
  }  const page = (req.body.page - 1) * 2 || 0;
  const formattedUrl = `https://dummyjson.com/products/search?q=${query}&limit=2&skip=${page}`;

  fetch(formattedUrl)
    .then(response => response.json())
    .then(data => {
      data.products.forEach(product => {
        product.final_price = (product.price * (1 - product.discountPercentage / 100)).toFixed(2);
      });

      req.processedData = {
        products: data.products.map(product => ({
          title: product.title,
          description: product.description,
          final_price: product.final_price
        }))
      };

      next();
    })
    .catch(err => sendErrorResponse(res, 400, err.message));
}

function handleData(req, res, next) {
  const newData = req.processedData;
  req.newData = newData;
  sendResponse(res, req, newData);
  next();
}

function loggingMiddleware(req, res) {
  const method = req.method;
  const path = req.path;
  const requestBody = req.body ? req.body : undefined;
  const dateTime = new Date().toISOString();

  const requestLog = {
    type: "messageIn",
    body: requestBody,
    method,
    path,
    dateTime,
  };

  console.log(JSON.stringify(requestLog, null, 2));

  const responseDateTime = new Date().toISOString();
  const responseStatusCode = res.statusCode;
  const responseBody = req.newData ? req.newData : res.get('Content-Type') === 'application/json' ? res.body : res.body;

  const responseLog = {
    type: "messageOut",
    body: responseBody,
    responseDateTime,
    fault: "",
  };

  console.log(JSON.stringify(responseLog, null, 2));

  if (req.error) {
    responseLog.fault = req.error.stack !== undefined ? req.error.stack : "";
  }
}

function sendResponse(res, req, data) {
  const acceptHeader = req.get('Accept');

  // ja headerī uzlikts ka pieņem xml tad izsūta xml, ja nē tad json
  if (acceptHeader && acceptHeader.includes('application/xml')) {
    const xmlBuilder = new xml2js.Builder();
    const xmlData = xmlBuilder.buildObject(data);
    res.set('Content-Type', 'application/xml');
    res.send(xmlData);
    console.log(xmlData)
  } else {
    res.json(data);
  }
}

//vienkārši funkcija lai izsūtītu kļūdas ziņojumus json formātā
function sendErrorResponse(res, code, message) {
  res.status(code).json({
    error: {
      code,
      message,
    },
  });
}

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
