import React from 'react';
import Script from 'next/script';

const JotformChatbotEmbed = () => {
	const iframeId = "JotFormIFrame-01959ef932487428b3a586f887250cd8d3ac";
	const jotformAgentSrc = "https://agent.jotform.com/01959ef932487428b3a586f887250cd8d3ac?embedMode=iframe&background=1&shadow=1";
	const jotformEmbedHandlerScriptSrc = 'https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js';

	return (
		<>
			<iframe
				id={iframeId}
				title="RoboBuddy: Bulma Uzmanı"
				onLoad={() => {
					if (typeof window !== 'undefined') {
						window.parent.scrollTo(0, 0);
					}
				}}
				allowtransparency="true"
				allow="geolocation; microphone; camera; fullscreen"
				src={jotformAgentSrc}
				frameBorder="0"
				style={{
					minWidth: '100%',
					maxWidth: '100%',
					height: '688px', 
					border: 'none',
					width: '100%',
				}}
				scrolling="no"
			></iframe>

			<Script
				id="jotform-embed-handler"
				src={jotformEmbedHandlerScriptSrc}
				strategy="afterInteractive"
				onLoad={() => {
					if (window.jotformEmbedHandler) {
						window.jotformEmbedHandler(`iframe[id='${iframeId}']`, "https://www.jotform.com");
					} else {
						console.warn('Jotform Embed Handler is not available.');
					}
				}}
				onError={(e) => {
					console.error('Jotform Embed Handler Script failed to load', e);
				}}
			/>
		</>
	);
};

export default JotformChatbotEmbed;