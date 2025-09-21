let reviews = [];

async function loadReviews() {
    try {
        const response = await fetch('reviews_test.tsv');
        const tsvData = await response.text();
        
        return new Promise((resolve, reject) => {
            Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: function(results) {
                    reviews = results.data
                        .filter(row => row.text && row.text.trim())
                        .map(row => row.text.trim());
                    resolve(reviews);
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        throw new Error('Failed to load reviews file: ' + error.message);
    }
}

async function analyzeSentiment(reviewText, apiToken) {
    const url = 'https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english';
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: reviewText })
        });
        
        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('Model is loading, please try again in a few seconds');
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please add an API token for higher limits');
            } else if (response.status === 401) {
                throw new Error('Invalid API token');
            } else {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

function getSentimentIcon(sentiment) {
    switch(sentiment) {
        case 'positive':
            return '<i class="fas fa-thumbs-up"></i> Positive';
        case 'negative':
            return '<i class="fas fa-thumbs-down"></i> Negative';
        default:
            return '<i class="fas fa-question-circle"></i> Neutral';
    }
}

function determineSentiment(apiResponse) {
    if (!apiResponse || !apiResponse[0] || !apiResponse[0][0]) {
        return 'neutral';
    }
    
    const result = apiResponse[0][0];
    
    if (result.label === 'POSITIVE' && result.score > 0.5) {
        return 'positive';
    } else if (result.label === 'NEGATIVE' && result.score > 0.5) {
        return 'negative';
    } else {
        return 'neutral';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingElement = document.getElementById('loading');
    const resultElement = document.getElementById('result');
    const reviewTextElement = document.getElementById('reviewText');
    const sentimentResultElement = document.getElementById('sentimentResult');
    const errorElement = document.getElementById('error');
    
    let reviewsLoaded = false;
    
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Loading reviews...';
    
    loadReviews()
        .then(() => {
            reviewsLoaded = true;
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Random Review';
        })
        .catch(error => {
            showError('Failed to load reviews: ' + error.message);
            analyzeBtn.textContent = 'Failed to load reviews';
        });
    
    analyzeBtn.addEventListener('click', async function() {
        if (!reviewsLoaded) return;
        
        errorElement.style.display = 'none';
        resultElement.style.display = 'none';
        loadingElement.style.display = 'block';
        analyzeBtn.disabled = true;
        
        const apiToken = document.getElementById('apiToken').value.trim();
        const randomReview = reviews[Math.floor(Math.random() * reviews.length)];
        
        reviewTextElement.textContent = `"${randomReview}"`;
        
        try {
            const sentimentData = await analyzeSentiment(randomReview, apiToken);
            const sentiment = determineSentiment(sentimentData);
            
            sentimentResultElement.innerHTML = getSentimentIcon(sentiment);
            sentimentResultElement.className = `sentiment-result ${sentiment}`;
            
            resultElement.style.display = 'block';
        } catch (error) {
            showError('Analysis failed: ' + error.message);
        } finally {
            loadingElement.style.display = 'none';
            analyzeBtn.disabled = false;
        }
    });
    
    function showError(message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
});
