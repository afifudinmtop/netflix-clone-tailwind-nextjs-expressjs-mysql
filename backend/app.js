const express = require("express");
const app = express();
const port = 8850;

const multer = require("multer");
const sharp = require("sharp");
const mysql = require("mysql");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const cors = require("cors");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

const uploadDir = "./public/uploads";

// delete file
const deleteFile = (filename) => {
  try {
    fs.unlinkSync(filename);
    console.log(`File ${filename} berhasil dihapus.`);
  } catch (err) {
    console.error(`Error saat menghapus file ${filename}: ${err.message}`);
  }
};

// rename file
const renameFile = (oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath);
    console.log(`File has been renamed from ${oldPath} to ${newPath}`);
  } catch (err) {
    console.error(`Error occurred while renaming the file: ${err.message}`);
  }
};

// Multer storage konfigurasi untuk menamai file sesuai UUID
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = file.mimetype.split("/")[1];
    const filename = uuidv4() + "." + ext;
    cb(null, filename);
  },
});

const upload = multer({ storage: storage });

// Konfigurasi MySQL
const pool = mysql.createPool({
  host: "localhost",
  user: "admin",
  password: "admin",
  database: "netflix",
});

// upload data
app.post("/data", upload.single("gambar"), async (req, res) => {
  try {
    const judul = req.body.judul;
    const kategori = req.body.kategori;
    const file = req.file;
    const resizedFilename = file.filename;

    // Resize gambar
    await sharp(file.path)
      .resize(341, 192)
      .toFile(`${uploadDir}/x-${resizedFilename}`);

    deleteFile(`${uploadDir}/${resizedFilename}`);

    renameFile(
      `${uploadDir}/x-${resizedFilename}`,
      `${uploadDir}/${resizedFilename}`
    );

    // Simpan data ke MySQL
    pool.query(
      "INSERT INTO movie SET ?",
      {
        uuid: resizedFilename.split(".")[0],
        gambar: resizedFilename,
        judul: judul,
        kategori: kategori,
      },
      (error, results, fields) => {
        if (error) throw error;
        res.redirect("./");
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// get data all
app.get("/data", (req, res) => {
  pool.query("SELECT * FROM movie", (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(results);
  });
});

// get data
app.get("/data/:uuid", (req, res) => {
  const uuid = req.params.uuid;
  pool.query(
    "SELECT * FROM movie WHERE uuid = ?",
    [uuid],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(results);
    }
  );
});

// get kategori
app.post("/data/kategori/", (req, res) => {
  const kategori = req.body.kategori;
  pool.query(
    "SELECT * FROM movie WHERE kategori = ?",
    [kategori],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      res.json(results);
    }
  );
});

// delete data
app.delete("/data/:uuid", (req, res) => {
  const uuid = req.params.uuid;

  pool.query(
    "SELECT * FROM movie WHERE uuid = ?",
    [uuid],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const dataToDelete = results[0];

      // mulai hapus
      pool.query(
        "DELETE FROM movie WHERE uuid = ?",
        [uuid],
        (error, results, fields) => {
          if (error) {
            return res.status(500).json({ error: error.message });
          }

          deleteFile(`${uploadDir}/${dataToDelete.gambar}`);
          res.send("deleted");
        }
      );
    }
  );
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
