const express = require("express")

const app = express()

app.get("/api", (req, res) => {
    res.json({
        backend: "stable",
        message: "Everything working perfectly"
    })
})

app.listen(5001, () => {
    console.log("Stable backend running on port 5001")
})