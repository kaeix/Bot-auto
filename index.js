const express = require('express');
const bodyParser = require('body-parser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const sessions = {};

// Rota criada para mensagens por whatsapp

app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();
  const fromNumber = req.body.From;
  const message = req.body.Body.trim().toLowerCase();

  
// Mensagem de boas vindas e menu de opções

  if (!sessions[fromNumber]) {
    sessions[fromNumber] = { state: 'app' };
    twiml.message('Olá! Somos a autorizaAPy, seu aplicativo para facilitar visitas condominiais. Escolha uma das opções abaixo e envie o número referente a sua escolha: \n\n1- Autorizar um visitante \n2- Falar com algum atendente');
  } 
    else if (sessions[fromNumber].state === 'app') {
        if (message === '1') {
            sessions[fromNumber].state = 'waiting_for_cep';
            twiml.message('Por favor, digite seu CEP:');

        } else if (message === '2') {
            sessions[fromNumber].state = 'app';
            twiml.message('Em breve um de nossos atendentes entrará em contato com você.');
        } else {
            twiml.message('Opção inválida. Por favor, digite um número válido:');
        }

        // Pesquisa sobre o CEP após a escolha 1 com API de busca de CEP

    } else if (sessions[fromNumber].state === 'waiting_for_cep') {
        if (isValidCEP(message)) {
            try {
                const address = await getAddressFromCEP(message);
                sessions[fromNumber].state = 'waiting_for_ok';
                twiml.message(`Seu endereço é: ${address}. \nDigite OK se estiver correto.`);
                
            } catch (error) {
                twiml.message('CEP não encontrado. Por favor, digite um CEP válido:');
            }           
        }
        else {
          twiml.message('CEP inválido. Por favor, digite um CEP válido:');
        }}

        // Confirmação do endereço e solicitação do nome do visitante

    else if (sessions[fromNumber].state === 'waiting_for_ok') {
        if (message.toLowerCase() === 'ok') {
          twiml.message('Digite o nome do visitante:')
          sessions[fromNumber].state = 'waiting_for_name';
        } else {
          twiml.message('Digite novamente o CEP:')
          sessions[fromNumber].state = 'waiting_for_cep';
        }}
    else if (sessions[fromNumber].state === 'waiting_for_name') {
      twiml.message(`Certo o visitante ${message} está autorizado a entrar no condomínio.`);
      twiml.message('Deseja autorizar mais um visitante? \n\n1- Sim \n2- Não');
      sessions[fromNumber].state = 'waiting_for_more';
    }

    // Confirmação de mais um visitante ou não e encerramento da conversa

    else if (sessions[fromNumber].state === 'waiting_for_more') {
      if (message === '1') {
        twiml.message('Por favor, digite seu CEP:')
        sessions[fromNumber].state = 'waiting_for_cep';
      } else if (message === '2') {
        twiml.message('Obrigado por utilizar o autorizaAPy. Até a próxima!');
        sessions[fromNumber].state = 'waiting_for_new';
      }
    }

    // Retorno ao menu de opções 

    else if (sessions[fromNumber].state === 'waiting_for_new') {
      twiml.message('Olá! Somos a autorizaAPy, seu aplicativo para facilitar suas visitas condominiais. Escolha uma das opções abaixo e envie o número referente a sua escolha: \n\n1- Autorizar um visitante \n2- Falar com algum atendente');
      sessions[fromNumber].state = 'app';
    }
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
    
  });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

// Função de validação e busca de CEP
// CEP só será válido se tiver 8 dígitos de 0-9

function isValidCEP(cep) {
  return /^[0-9]{8}$/.test(cep);
}

// API de busca de CEP

async function getAddressFromCEP(cep) {
  const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
  const data = response.data;

  if (data.erro) {
    throw new Error('CEP não encontrado');
  }

  return `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`;
}