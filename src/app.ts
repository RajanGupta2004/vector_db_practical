

import express from 'express'
import multer from 'multer'
import { PDFParse } from 'pdf-parse';
const app = express()

app.use(express.json())


app.get("/", (req, res) => {
    return res.status(200).json({
        message: "server is running"
    })
})


const upload = multer({ dest: 'public/uploads/' })


app.post("/upload", upload.single("pdf"), async (req, res) => {
    try {

        const parser = new PDFParse({ url: req.file?.path });
        const result = await parser.getText();
        await parser.destroy();

        const text = result.text

        // const chunks = []

        // for (let i = 0; i < text.length; i += 500) {
        //     chunks.push(i , text.slice(i))
        // }

        // console.log("chunks" , chunks)

        const chunks = text.split("\n\n")


        return res.status(200).json({
            message: "file pased successfully",
            chunks: chunks.length,
            data:chunks
        })

    } catch (error) {
        console.log("Error in file Upload", error)
        return res.status(500).json({
            message: "Some thing went wrong"
        })

    }
})



export default app