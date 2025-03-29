const axios = require('axios');

const TEST_TIMEOUT = 15000;
const websites = [
    'https://www.dementia.org.au/',
    'https://www.ssv445.com',
    'https://readybytes.in/blog',
    'https://www.seoaffiliatedomination.com/blog',
    'https://authorkeynotes.com/',
    'https://linkstorm.io',
    'https://blog.linkody.com',
    'https://sitechecker.pro',
    'https://indexcheckr.com',
    'https://0mrr.com',
    'https://www.creditbenchmark.com/',
    'https://taqtics.ai/',
    'https://app.advcollective.com/',
    'https://blog.cirquedusoleil.com/',
    'https://www.schedulethreads.com/',
    "https://www.essentialnutrition.com.br",
    "https://buzzingbees-preschool.com",
    "https://www.frankdoolittle.com",
    "https://biztechcommunity.com",
    "https://cashtopedia.com",
    "https://www.youngurbanproject.com",
    "https://www.911-housebuyers.com",
    "https://ganknow.com",
    "https://www.worknice.com",
    "https://www.drainfieldsolutions.com",
    "https://digitlnomad.com",
    "https://discoveryone.gg",
    "https://www.nationalhomeloans.com",
    "https://www.ranq.io",
    "https://www.coinex.com",
    "https://newquaycab.com",
    "https://www.rawfunds.com",
    "https://nutrabay.com",
    "https://portstlucietalks.com",
    "https://www.dementia.org.au",
    "https://www.affordablecollegesonline.org",
    "https://bluepeaksroofing.com",
    "https://careroofingsolutions.com",
    "https://www.goempiremovers.com",
    "https://www.justpark.com",
    "https://wholesaleconnections.com",
    "https://briertonjones.com",
    "https://www.fulfyld.com",
    "https://1xbet-my-app.org",
    "https://blog.linkody.com",
    "https://www.yeezyspk.ru",
    "https://ambulancemed.com",
    "https://ohiopyle.co",
    "https://www.aaastl.com",
    "https://wyomingbuildingsupply.com",
    "https://3vs.co",
    "https://opattack.com",
    "https://indexcheckr.com",
    "https://www.nitsotech.com",
    "https://www.revefi.com",
    "https://www.gunspart.com",
    "https://chekkee.com",
    "https://admhss.mhc.wa.gov.au",
    "https://www.greenlandinvestgroup.com",
    "https://www.finosauras.com",
    "https://www.greenpakistaninitiative.com",
    "https://recruitcrm.io",
    // "https://mockdatasets.xyz",
    "https://indianatopsoil.com",
    "https://www.bajajenterprises.net",
    "https://lowmoqclothingmanufacturer.com",
    "https://www.barneyscafe.co.uk",
    "https://megasolutionelectricalengineering.com",
    "https://www.sawdays.co.uk",
    "https://buzzingbees-preschool.com",
    "https://www.frankdoolittle.com/",
    "https://biztechcommunity.com/",
    "https://cashtopedia.com/",
    "https://www.youngurbanproject.com/",
    "https://www.911-housebuyers.com/",
    "https://ganknow.com/blog/",
    "https://www.worknice.com",
    "https://www.drainfieldsolutions.com/",
    "https://digitlnomad.com/",
    "https://discoveryone.gg/",
    "https://www.nationalhomeloans.com/",
    "https://www.ranq.io/",
    "https://newquaycab.com/",
    "https://www.rawfunds.com",
    "https://nutrabay.com",
    "https://portstlucietalks.com",
    "https://www.dementia.org.au/",
    "https://www.affordablecollegesonline.org/",
    "https://bluepeaksroofing.com/",
    "https://careroofingsolutions.com/",
    "https://www.goempiremovers.com/",
    "https://www.justpark.com/",
    "https://wholesaleconnections.com/",
    "https://briertonjones.com/",
    "https://www.fulfyld.com",
    "https://1xbet-my-app.org/",
    "https://www.moonlink.site/",
    "https://blog.linkody.com/",
    "https://www.yeezyspk.ru/",
    "https://ambulancemed.com/",
    "https://ohiopyle.co/",
    "https://www.aaastl.com",
    "https://wyomingbuildingsupply.com/",
    "https://3vs.co/",
    "https://opattack.com/",
    "https://betmaster.com.mx/es-mx",
    "https://indexcheckr.com/",
    "https://www.nitsotech.com/",
    "https://www.revefi.com/",
    "https://www.gunspart.com",
    "https://chekkee.com/",
    "https://admhss.mhc.wa.gov.au/",
    "https://www.greenlandinvestgroup.com/",
    "https://www.finosauras.com/blog",
    "https://www.greenpakistaninitiative.com/",
    "https://recruitcrm.io/",
    // "https://mockdatasets.xyz/",/
    "https://indianatopsoil.com/",
    "https://www.bajajenterprises.net/",
    "https://lowmoqclothingmanufacturer.com",
    "https://www.barneyscafe.co.uk",
    "https://www.sawdays.co.uk/",
    "https://www.cloudesign.com/",
    "https://www.cranesouth.com/",
    "https://bedrockplumbers.com/",
    "https://oklahomalawyer.com/",
    "https://guidesforbrides.co.uk/",
    "https://cybersnowden.com/",
    "https://annocomputatri.net/",
    "https://foogogreen.com/",
    "https://hindastro.com/",
    "https://bharathiinteriors.com/",
    "https://shop.luvmehair.com/collections/curly-wig",
    "https://mapex.io/en/",
    "https://www.giftseize.io/",
    "https://www.familykitchencabinetry.com/",
    "https://www.bankrate.com/mortgages/biggest-refinance-myths/",
    "https://pinnacledds.com/",
    "https://page1rank.com/",
    "https://www.italiamia.com/",
    "https://networthbiohub.com/",
    "https://www.allqualityroofing.com.au/",
    "https://gippslander.com.au/",
    "https://retirementforbeginners.net/",
    "https://drchikeclinics.com/",
    "https://appwrk.com/",
    "https://kissflow.com/workflow/bpm/beginners-guide-to-client-onboarding/",
    "https://designwest.ie/",
    "https://www.sportsgeek.com/",
    "https://tilesmate.com.au/",
    "https://beformnutrition.com/",
    "https://www.ajg.com/au/",
    "https://www.jbplegal.com/",
    "https://insurekar.pk/",
    "https://converzation.com/article/",
    "https://dralexphoon.com/",
    "https://www.spendable.com.au/",
    "https://www.traveltoparadiso.com/",
    "https://www.mindex.com/",
    "https://getboober.com/",
    "https://pepeunchained.com/en/",
    "https://13melbourneairporttaxi.com",
    "https://deriv.com/trading-terms-glossary",
    "https://www.legalzoom.com/country/nl",
    "https://mailtrap.io/",
    "https://www.ismartrecruit.com/",
    "https://ytshortsdown.com/en/",
    "https://gotechifyit.com/",
    "https://www.dareem.shop/",
    "https://infotab.org/",
    "https://www.hubli.net/",
    "https://scangeni.us/",
    "https://www.prophecy.io",
    "https://jalammar.github.io/",
    "https://www.calcgenie.com/",
    "https://publishergrowth.com/",
    "https://www.datax.ai/",
    "https://nexusmk.com/",
    "https://avaada.com/",
    "https://philipsuniversalremotecodes.com/",
    "https://mydmvappointment.com/",
    "https://thepodcastpedia.com/",
    "https://neyaclinic.com/best-hair-transplant-clinic-in-hyderabad/",
    "https://www.therevolutionarymind.at/en",
    "https://www.thirdrocktechkno.com/blog/flutterflow-vs-flutter/",
    "https://www.accurl.com/",
    "https://www.instacabo.com/",
    "https://www.my-carrentals.com/",
    "https://www.squadcast.com/",
    "https://www.skailama.com/",
    "https://foyr.com/",
    "https://wordpresswebsitesupport.com.au/",
    "https://www.w2gositeservices.com/",
    "https://africacenter.org",
    "https://theawakeningofdeath.com/",
    "https://flymetothesun.eu/",
    "https://operandio.com/restaurant-standards/",
    "https://www.codewalnut.com/",
    "https://gcmarketingsupport.com/",
    "https://www.pleasureinjapan.com/blog",
    "https://igni7e.com/blog",
    "https://ninjawifi.com/en/blog",
    "https://www.biooptimalsupplements.com/",
    "https://findcardubai.com/",
    "https://character.ai/",
    "https://www.hampsteadaesthetics.com/",
    "https://1plushealth.com/",
    "https://betmaster.com.mx",
    "https://www.bestnetflixvpn.com/",
];

// console.log("Total websites:", websites.length);
//filter out duplicates
const uniqueWebsites = [...new Set(websites)];
// console.log("Unique websites:", uniqueWebsites.length);

// split into 9 groups
const groupedWebsites = [];
for (let i = 0; i < uniqueWebsites.length; i++) {
    const groupIndex = Math.floor(i / (uniqueWebsites.length / 9));
    if (!groupedWebsites[groupIndex]) {
        groupedWebsites[groupIndex] = [];
    }
    groupedWebsites[groupIndex].push(uniqueWebsites[i]);
}

// Configure axios to use proxy
const axiosProxyInstance = axios.create({
    proxy: {
        host: 'localhost',
        port: 3000,
        protocol: 'http',
    },
    // Still don't throw on non-200
    validateStatus: () => true,
    maxRedirects: 0,
    timeout: 10000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000'
    }
});

const axiosInstance = axios.create({
    validateStatus: () => true,
    maxRedirects: 0,
    maxRedirects: 0,
    timeout: 31000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
        'x-api-key': '1234567890',
        'x-page-timeout-ms': '10000'
    }
});

const PROBLEMATIC_HTTP_STATUS_CODES = [408, 429, 502, 503, 504, 403];
const RETRY_AGAIN_HTTP_STATUS_CODES = [429, 503];

const testWebsite = async (website) => {
    let response;
    let startTime;
    let axiosResponse;
    try {
        startTime = Date.now();
        // fetch via rendere
        [axiosResponse, response] = await Promise.all([
            axios.get(website),
            axiosInstance.get('http://localhost:3000/?render_url=' + website),
        ]);

        //check if the response is the same for successful responses
        if (axiosResponse.status === 200) {
            expect(response.status).toBe(200);
        }

        if (response.status === 200) {
            if (!response.data.includes('<body')) {
                expect('body tag not found').toBe(true);
            }
        } else {
            console.log(`[${website}] Got response in ${Date.now() - startTime}ms, Status: ${response.status}, Content length: ${response.data?.length || 0}, Error: ${response.data?.error || ''}`);
            if (PROBLEMATIC_HTTP_STATUS_CODES.includes(response.status)) {
                expect(response.status).toBe(200);
            }
        }
    } catch (error) {
        console.log(`[Website ${website}, Response: ${response?.status}] Error:`, error.message);
        throw error;
    }
}

module.exports = {
    axiosProxyInstance,
    axiosInstance,
    groupedWebsites,
    testWebsite,
    TEST_TIMEOUT
}