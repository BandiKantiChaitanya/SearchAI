const topics = ['Job Referral','Design Logo','Portfolio Review','LinkedIn Optimization','Website Hosting','Learn New Words','Profile Creation','Mock Interviews','Resume Building','Freelance Work','Startup Ideas','Career Advice','Personal Branding','Remote Jobs','Coding Help','Public Speaking Tips','Time Management','Interview Questions','Build a Website','Social Media Strategy','UI/UX Feedback','Create a Newsletter','Build Side Projects','Learn a Framework']

const intro = document.getElementById('intro-section');
const topicsContainer = document.getElementById('topics-container');
const promptContainer = document.getElementById('prompt-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const inputWrapper=document.getElementById('input-wrapper')


topics.forEach(topic => {
  const btn = document.createElement('button');
  btn.className = 'topic-btn';
  btn.textContent = topic;
  btn.onclick = () => handleSubmit(topic);
  topicsContainer.appendChild(btn);
});

promptContainer.classList.add('hidden');


let conversationHistory = [];

// Add prompt on submit
function handleSubmit(value) {
  const input = value || searchInput.value.trim();
  if (!input) return;

  


  if (!promptContainer.classList.contains('visible')) {
    intro.classList.add('hidden');
    topicsContainer.classList.add('hidden');
    promptContainer.classList.remove('hidden');
    promptContainer.classList.add('visible');
    inputWrapper.classList.add('shift-up');
  }

  const msgWrapper = document.createElement('div');
  msgWrapper.className = 'message-wrapper user';

  const msg = document.createElement('div');
  msg.className = 'prompt-message';
  msg.textContent = input;

  msgWrapper.appendChild(msg)
  promptContainer.appendChild(msgWrapper);

  promptContainer.scrollTop = promptContainer.scrollHeight;

  

  searchInput.value = '';

  
  // fetch('https://fakestoreapi.com/products?limit=10')
  // .then(res=>res.json())
  // .then(products=>{
  //   const resWrapper=document.createElement('div')
  //   const response=document.createElement('div')
    
  //   response.className='prompt-response'
  //   response.innerHTML+=`<p>The responses of the products are</p>`
  //   products.forEach(product => (
  //     response.innerHTML+=`
  //   <p>${product.title}</p>
  //   `
  //   ));

  //     resWrapper.className='message-wrapper response'
  //     resWrapper.appendChild(response)
  //     promptContainer.appendChild(resWrapper)
  // }
  // )
  // .catch(err=>console.log('Error Occured',err))

// console.log('Hi')
conversationHistory.push({ role: 'user', content: input });

if (conversationHistory.length > 6) {
  conversationHistory = conversationHistory.slice(-6); // keep last 6
}
// http://localhost:3000/chat

  fetch('https://searchai-do1g.onrender.com/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({query: input, history :conversationHistory,force_detail: input.toLowerCase().includes("yes") }),
})
.then(res => res.json())
.then(data => {
  conversationHistory.push({ role: 'assistant', content: data.reply });

  const fullText = data.ai_answer;

  // Extract product blocks and intro/outro text
  const productBlocks = fullText.match(/Product:[\s\S]*?(?=(?:Product:|$))/g) || [];
  const introText = fullText.split("Product:")[0].trim();

  // Try to get outro text from the last block (similar to before)
  let outroText = null;
  if (productBlocks.length) {
    const lastBlock = productBlocks[productBlocks.length - 1];
    const detailsMatch = lastBlock.match(/Details:[\s\S]*/);
    if (detailsMatch) {
      const detailsText = detailsMatch[0].replace('Details:', '').trim();
      const outroMatch = detailsText.match(/(.+?)(\s+Would you like.*)/i);
      if (outroMatch) {
        outroText = outroMatch[2].trim();
        // Remove outro part from the last block to avoid duplication
        productBlocks[productBlocks.length - 1] = lastBlock.replace(outroText, '').trim();
      }
    }
  }

  const resWrapper = document.createElement('div');
  resWrapper.className = 'message-wrapper response';

  const response = document.createElement('div');
  response.className = 'prompt-response';

  // 1. Render intro text normally (outside adaptive cards)
  if (introText) {
    const introPara = document.createElement('p');
    introPara.textContent = introText;
    response.appendChild(introPara);
  }

  // 2. For each product block, create an Adaptive Card and append
  productBlocks.forEach(block => {
    const lines = block.split(/Description:|Details:/);
    if (lines.length < 3) return;

    const name = lines[0].replace("Product:", "").trim();
    const description = lines[1].trim();
    const details = lines[2].trim();

    // Build Adaptive Card payload
    const cardPayload = {
      type: "AdaptiveCard",
      version: "1.4",
      body: [
        {
          type: "TextBlock",
          text: name,
          weight: "Bolder",
          size: "Medium",
          color: "#007b5e",
          wrap: true,
          spacing: "Medium",
        },
        {
          type: "TextBlock",
          text: description,
          wrap: true,
          weight: "Bolder",
          spacing: "Small",
          color: "Default",
        },
        {
          type: "TextBlock",
          text: details,
          wrap: true,
          spacing: "Small",
          color: "Default",
        },
      ],
    };

    const adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.parse(cardPayload);
    const renderedCard = adaptiveCard.render();

    response.appendChild(renderedCard);
  });

  // 3. Render outro text normally (outside adaptive cards)
  if (outroText) {
    const outroPara = document.createElement('p');
    outroPara.textContent = outroText;
    response.appendChild(outroPara);
  }

  resWrapper.appendChild(response);
  promptContainer.appendChild(resWrapper);
  promptContainer.scrollTop = promptContainer.scrollHeight;
})

.catch(err => console.log('Error:', err));

  

}

searchBtn.onclick = () => handleSubmit();
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSubmit();
});