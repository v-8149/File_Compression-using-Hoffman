const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const app = express();
const upload = multer({ dest: 'uploads/' }); // Temporary directory for uploaded files

// Serve static files
app.use(express.static(__dirname));

// Huffman Compression Function
function huffmanCompress(data) {
    const freqMap = {};
    for (let char of data) {
        if (!freqMap[char]) freqMap[char] = 0;
        freqMap[char]++;
    }

    // Create priority queue (min-heap)
    const priorityQueue = Object.keys(freqMap).map(char => ({
        char,
        freq: freqMap[char],
        left: null,
        right: null
    })).sort((a, b) => a.freq - b.freq);

    // Build Huffman Tree
    while (priorityQueue.length > 1) {
        let left = priorityQueue.shift();
        let right = priorityQueue.shift();
        let newNode = {
            char: null,
            freq: left.freq + right.freq,
            left,
            right
        };
        priorityQueue.push(newNode);
        priorityQueue.sort((a, b) => a.freq - b.freq);
    }
    const huffmanTree = priorityQueue[0];

    // Generate Huffman codes
    const huffmanCodes = {};
    function generateCodes(node, code) {
        if (!node) return;
        if (node.char !== null) {
            huffmanCodes[node.char] = code;
        }
        generateCodes(node.left, code + '0');
        generateCodes(node.right, code + '1');
    }
    generateCodes(huffmanTree, '');

    // Encode the data
    let encodedData = '';
    for (let char of data) {
        encodedData += huffmanCodes[char];
    }

    // Convert the encoded string into a binary buffer
    const buffer = Buffer.alloc(Math.ceil(encodedData.length / 8));
    for (let i = 0; i < encodedData.length; i++) {
        if (encodedData[i] === '1') {
            buffer[Math.floor(i / 8)] |= (1 << (7 - (i % 8)));
        }
    }

    return { buffer, huffmanCodes };
}

// Huffman Decompression Function
function huffmanDecompress(buffer, huffmanCodes) {
    const reverseHuffmanCodes = Object.fromEntries(
        Object.entries(huffmanCodes).map(([key, value]) => [value, key])
    );

    // Convert the buffer back to a binary string
    let binaryString = '';
    for (let byte of buffer) {
        for (let i = 0; i < 8; i++) {
            binaryString += (byte & (1 << (7 - i))) ? '1' : '0';
        }
    }

    let currentCode = '';
    let decodedData = '';
    for (let bit of binaryString) {
        currentCode += bit;
        if (reverseHuffmanCodes[currentCode]) {
            decodedData += reverseHuffmanCodes[currentCode];
            currentCode = '';
        }
    }
    
    return decodedData;
}

// Route for file upload and processing
app.post('/compress', upload.single('file'), (req, res) => {
    const filePath = req.file.path;
    const outputPath = path.join(__dirname, 'compressed.bin'); // Output compressed file path

    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) return res.status(500).send('Error reading file');

        // Compress the file using Huffman Compression
        const { buffer, huffmanCodes } = huffmanCompress(data);

        // Write the compressed data to a new file
        fs.writeFile(outputPath, buffer, (err) => {
            if (err) return res.status(500).send('Error writing compressed file');

            // Respond with JSON containing the download link
            res.json({
                compressedFile: '/compressed.bin', // Relative path for the download link
                decompressedText: data // Original text to show after decompression (if needed)
            });
        });
    });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
