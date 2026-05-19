
document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('portfolio-conteudo');

    const navButtons = document.querySelectorAll('.portfolio-nav-button');

    const loadPortfolioContent = async (pageUrl) => {
        if (!contentArea) {
            console.error('error');
            return;
        }

        contentArea.innerHTML = '<p>loading...</p>';

        try {
            const response = await fetch(pageUrl);
            if (!response.ok) {
                throw new Error(`Falha na rede: ${response.statusText}`);
            }
            const htmlText = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            const contentNode = doc.querySelector('.portfolioContent') || doc.querySelector('.grid-feed');

            if (contentNode) {
                contentArea.innerHTML = contentNode.innerHTML;
            } else {
                console.warn(`${pageUrl}.`);
                contentArea.innerHTML = doc.body.innerHTML;
            }
        } catch (error) {
            console.error('error:', error);
            contentArea.innerHTML = '<p style="color: red;">error</p>';
        }
    };

    navButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();

            const pageFile = button.dataset.page;
            if (pageFile) {
                loadPortfolioContent(pageFile);
            }
        });
    });
});