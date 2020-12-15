const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const multer = require('multer');
const upload = multer();
require("dotenv").config();

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/customers", (req, res) => {
  const model = {
    totalRecords: 2,
    editor: {
      cusid: "",
      cusfname: "",
      cuslname: "",
      cusstate: "",
      cussalesytd: "",
      cussalesprev: "",
    },
    customers: [],
    recordsFound: 0,
    isSearched: false,
  };
  pool.query("SELECT * FROM customer", (err, result) => {
    model.totalRecords = result.rowCount;
    res.render("customers", { model: model });
  });
});

app.post("/customers", (req, res) => {
  const model = {
    totalRecords: 2,
    editor: req.body,
    customers: [],
    recordsFound: 0,
    isSearched: true,
  };

  let query = `SELECT * FROM customer`;
  const segments = [];
  Object.keys(req.body).forEach((key) => {
    if (key === "cusid" && !!req.body[key]) {
      segments.push(`cusid = ${req.body[key]}`);
    }
    if (key === "cusstate" && !!req.body[key]) {
      segments.push(`cusstate = '${req.body[key].trim()}'`);
    }
    if (key === "cusfname" && !!req.body[key]) {
      segments.push(`cusfname LIKE '${req.body[key].trim()}%'`);
    }
    if (key === "cuslname" && !!req.body[key]) {
      segments.push(`cuslname LIKE '${req.body[key].trim()}%'`);
    }
    if (key === "cussalesytd" && !!req.body[key]) {
      segments.push(`cussalesytd::numeric >= ${req.body[key]}`);
    }
    if (key === "cussalesprev" && !!req.body[key]) {
      segments.push(`cussalesprev::numeric >= ${req.body[key]}`);
    }
  });
  if (segments.length) {
    query = query + " WHERE " + segments.join(" AND ");
  }

  pool.query("SELECT * FROM customer", (err, result) => {
    model.totalRecords = result.rowCount;
    pool.query(query, (err, data) => {
      model.customers = data.rows;
      model.recordsFound = data.rowCount;
      res.render("customers", { model: model });
    });
  });
});

app.get("/create", (req, res) => {
  const model = {
    editor: {
      cusid: "",
      cusfname: "",
      cuslname: "",
      cusstate: "",
      cussalesytd: "",
      cussalesprev: "",
    },
    isSuccess: false,
    hasError: false,
    error: null,
  };
  res.render("create", { model: model });
});

app.post("/create", (req, res) => {
  const body = req.body;
  const sql = `INSERT INTO customer (cusid, cusfname, cuslname, cusstate, cussalesytd, cussalesprev)
	VALUES (${body.cusid}, '${body.cusfname}', '${body.cuslname}', '${body.cusstate}', ${body.cussalesytd}, ${body.cussalesprev})`;

  pool.query(sql, (err, data) => {
    if (err) {
      res.render("create", {
        model: {
          editor: req.body,
          isSuccess: false,
          hasError: true,
          error: err,
        },
      });
    } else {
      res.render("create", {
        model: {
          editor: req.body,
          isSuccess: true,
          hasError: false,
          error: null,
        },
      });
    }
  });
});

app.get("/edit/:id", (req, res) => {
  const id = req.params.id;
  const sql = `SELECT cusid, cusfname, cuslname, cusstate, cussalesytd::numeric, cussalesprev::numeric FROM customer WHERE cusid = ${id}`;

  pool.query(sql, (err, data) => {
    res.render("edit", { model: { editor: data.rows[0] } });
  });
});

app.post("/edit/:id", (req, res) => {
  const body = req.body;
  const id = req.params.id;
  const sql = `
		UPDATE customer SET cusfname = '${body.cusfname}', 
		cuslname = '${body.cuslname}', 
		cusstate = '${body.cusstate}', 
		cussalesytd = ${body.cussalesytd}, 
		cussalesprev = ${body.cussalesprev} WHERE cusid = ${id}`;

  pool.query(sql, (err, data) => {
    res.render("edit", {
      model: { editor: { ...body, cusid: id }, isSuccess: true },
    });
  });
});

app.get("/delete/:id", (req, res) => {
  const id = req.params.id;
  const sql = `SELECT cusid, cusfname, cuslname, cusstate, cussalesytd::numeric, cussalesprev::numeric FROM customer WHERE cusid = ${id}`;

  pool.query(sql, (err, data) => {
    res.render("delete", { model: { editor: data.rows[0] } });
  });
});

app.post("/delete/:id", (req, res) => {
  const body = req.body;
  const id = req.params.id;
  const sql = `DELETE FROM customer WHERE cusid = ${id}`;

  pool.query(sql, (err, data) => {
    res.render("delete", {
      model: { editor: { ...body, cusid: id }, isSuccess: true },
    });
  });
});

app.get("/reports", (req, res) => {
  res.render("reports", {
    model: { selected_type: "normal_lastname", customers: [] },
  });
});

app.post("/reports", (req, res) => {
	const report_map = {
    normal_lastname: `SELECT * FROM customer ORDER BY cuslname, cusfname ASC`,
    total_sales_decreasing: `SELECT * FROM customer ORDER BY cussalesytd::numeric DESC`,
    random_customers: `SELECT * FROM customer ORDER BY RANDOM() LIMIT 3`,
  };
	const report_type = req.body.report_type;
	
	pool.query(report_map[report_type], (err, data) => {
		res.render("reports", { model: { selected_type: report_type, customers: data.rows } });
	});
  
});

app.get("/import", (req, res) => {
  const model = {
    totalRecords: 0,
  };

  pool.query("SELECT * FROM customer", (err, result) => {
    model.totalRecords = result.rowCount;
    res.render("import", { model: model });
  });
});

app.post('/import', upload.single('filename'), async (req, res) => {
  if (!req.file || Object.keys(req.file).length === 0) {
    message = "Error: Import file not uploaded";
    return res.send(message);
	}
	
	const buffer = req.file.buffer;
	const lines = buffer.toString().split(/\r?\n/);
	const success = [];
	const errors = [];

	for (let line of lines) {
		const customer = line.split(',');
		const sql = `
			INSERT INTO customer
			(cusid, cusfname, cuslname, cusstate, cussalesytd, cussalesprev)
			VALUES (${customer[0]}, '${customer[1]}', '${customer[2]}', '${customer[3]}', ${customer[4]}, ${customer[5]})`;

			try {
				const result = await pool.query(sql);
				success.push(`Inserted successfully`);
			} catch(error) {
				errors.push(`Customer ID: ${customer[0]} - ${error.message}`);
			}
	}

  res.status(200).json({
		processed: lines.length,
		succeed: success.length,
		failed: errors.length,
		errors: errors
	});
});

app.get("/export", (req, res) => {
  const model = {
    totalRecords: 0,
  };

  pool.query("SELECT * FROM customer", (err, result) => {
    model.totalRecords = result.rowCount;
    res.render("export", { model: model });
  });
});

app.post('/export', (req,res) => {
	const fileName = req.body.fileName;
	const sql = `SELECT * FROM customer ORDER BY cusid`;

	pool.query(sql, (err, data) => {
		if (!err) {
			let output = '';
			data.rows.forEach(c => {
				output += `${c.cusid},${c.cusfname},${c.cuslname},${c.cusstate},${c.cussalesytd},${c.cussalesprev}\r\n`;
			});
			res.header("Content-Type", "text/csv");
			res.attachment(fileName);
			return res.send(output);
		}
	})
})

const port = process.env.PORT || 3000;

pool
  .connect()
  .then(() => {
    console.log("Connected to db...");
    app.listen(port, () => {
      console.log(`Server started on port ${port}`);
    });
  })
  .catch((err) => console.log(err));
