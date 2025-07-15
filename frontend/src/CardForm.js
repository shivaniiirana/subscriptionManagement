import React, { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

const CardForm = ({ userId }) => { // Removed hardcoded props
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [priceId, setPriceId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerId || !priceId) {
      setStatus('❌ Please enter Customer ID and Price ID');
      return;
    }

    const card = elements.getElement(CardElement);
    if (!stripe || !card) return;

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
      billing_details: {
        name,
        email,
      },
    });

    if (error) {
      setStatus('❌ ' + error.message);
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerId,
          priceId,
          paymentMethodId: paymentMethod.id,
          name,
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      
      setStatus('✅ Subscription Created!');
    } catch (err) {
      setStatus('❌ ' + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>
          Customer ID:
          <input 
            type="text" 
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="cus_XXXXXX"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Price ID:
          <input 
            type="text" 
            value={priceId}
            onChange={(e) => setPriceId(e.target.value)}
            placeholder="price_XXXXXX"
            required
          />
        </label>
      </div>
      <div>
        {/* <label>
          Name:
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Email:
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label> */}
      </div>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Subscribe
      </button>
      <p>{status}</p>
    </form>
  );
};

export default CardForm;