import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function ApiDashboardPage() {
  return (
    <main className="app-shell page-private">
      <Header />
      <div className="app-body">
        <Sidebar />
        <section className="app-content card">
          <p className="eyebrow">API Dashboard</p>
          <h1>MLB Player API Licensing</h1>
          <p className="muted">Learn about how we get every information about players.</p>
          <h3>API Licensing</h3>
          <p className="muted"> To get all the information we have about players, including depth chart, injury status, and more, we utilize an external API service that 
            retrieves information and calculates the suggested player prices. If you're interested in using their services to develop your own draft kit or to get player info,
            you can follow the instruction below to create an account and start utilizing it. </p>
          <h3> Step-by-Step Instruction to Setup and Start Utilizing API Services</h3>
          <ol>
            <li>Access the API website from <a href="https://api-licensing.pages.dev "target="_blank"> here</a> (It will open a new tab; or access it in the portal below)</li> 
            <li>Create an account using your email address and a password at the top. </li>
            <li>Once you have an account, enter your email address and the password to login and click on "Generate New API Token" to receive the your token. Your token should pop up on the dashboard.</li>
            <li>Before the initial use, increase your balance by making a payment to the API licensing website. Enter the dollar amount that you wish to pay to.</li>
            <li>You can check your balance and API usage by copy pasting the token into the relevant box. </li>
            <li>To utilize the API token to get information about players, you must send an HTTP fetch call that includes the key in the HTTP header x-api-token. You can find the format of API request information below.</li>
          </ol>

          <h4>Sample API HTTP Request</h4>
          The API service has multiple path for the requersts depending on what feature of the API you're looking to utlize. The following are details on how to get player evaluation information.<br />
          Since calls to the API Licensing requires that the account have balance a non-negative balance, so if the user does not have sufficient balances (notified through a 402 response status), they can add more “balance units” by making a POST call to /api/users/payments with a JSON body, <span>{"{amount: integer}"}</span>. <br />
          Once there is sufficient funds in the acocunt, you can send API requests such as player evaluations. <br />
          The JSON files sent in the player evaluation requests must contain a “request” object that includes fields “method” (set to POST), “path” set to “/api/players/evaluations”, and a “query” object which must have “moneyAboveMinimum” as a field since part of the evaluation of a player depends on the pool of money that is above the minimum $1 amount required for remaining roster spots available in the whole league. 
          Additionally, “draftHistory” will be an array of arrays of player names and how much they were drafted for (i.e. [nameOfPlayer, 30]) that is in the body of the request.<br />
          So for example, if there has been 5 drafted player, then the request for player evaluation would look like the below:
        
          <pre>
          {`
          {
          "state": "beforeDraftStart",
          "request": {
            "method": "POST",
            "path": "/api/players/evaluations",
            "query": {
              "moneyAboveMinimum": 2133,
              "limit": 200,
              "page": 1,
              "rankBy": "fantasyPoints",
              "order": "desc"
            }
            “draftHistory”: [
              ["William Contreras", "$25"],
              ["Daylen Lile", "$12"],
              ["Fernando Tatis", "$43"],
              ["Mookie Betts", "$28"],
              ["Ketel Marte", "$38"],
            ] 
          }
          }`}
        </pre>
        The fields, such as limit, page, rankBy, and order are not required, but it allows the response to be customized. For example, the limit sets the maximum value of the player to be the specified value.
        rankBy defines the criteria in which the players are returned, and order allows you to decide if the list should be in a descending or ascending order.
        


          <h3>API Licensing Portal</h3>
          <iframe
            src="https://api-licensing.pages.dev/"
            title="API Licensing Portal"
            width="100%"
            height="800px"
            style={{ border: "1px solid #ccc", borderRadius: "8px", marginTop: "12px" }}
          />
        </section>
      </div>
    </main>
  );
}

export default ApiDashboardPage;
