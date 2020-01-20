const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const axios = require('axios');
const util = require('util');
const hbs = require('handlebars');
const path = require('path');

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

// Complie html file and json file using handlebars
const compile = async function (templateName, data) {
    const filePath = path.join(process.cwd(), 'templates', `${templateName}.hbs`);
    const html = await readFileAsync(
        filePath,
        "utf8"
    );
    return hbs.compile(html)(data);
};

// Asks users their GitHub user name and favorite color
function promptUser() {
    return inquirer.prompt([
        {
            type: "input",
            name: "userName",
            message: "What is your GitHub user name?",
        },
        {
            type: "list",
            name: "color",
            message: "What is your favorite color?",
            choices: ["orange", "turquoise", "pink", "violet", "lightgreen"],
        }
    ]);
}

// Makes axios call to collect user's data based on user information provided
async function getGithubData() {
    const answers = await promptUser();

    const { data } = await axios.get(
        `https://api.github.com/users/${answers.userName}?per_page=100`
    );

    const reposData = await axios.get(
        `https://api.github.com/users/${answers.userName}/repos?per_page=100`
    );

    let starsCount = 0;
    reposData.data.map(function (res) {
        return starsCount += res.stargazers_count;
    });

    const locationSearch = () => {
        if (data.location != null && data.location.includes(" ")) {
            return data.location.split(" ").join("%20");
        }
        else return data.location;
    }

    const infoObj = {
        login: data.login, profileImg: data.avatar_url, name: data.name,
        location: data.location, locationLink: `https://www.google.com/maps/place/${locationSearch()}`, githubProfile: data.html_url, blog: data.blog, bio: data.bio,
        publicRepos: data.public_repos, followers: data.followers, githubStars: starsCount,
        following: data.following, favoriteColor: answers.color
    };

    await writeFileAsync(
        "developer-data.json",
        JSON.stringify(infoObj, null, 2),
        "utf8"
    );

    if (infoObj.name == null) return infoObj.login;
    else return infoObj.name;
}

// Generates pdf file using puppeteer
(async function () {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        const pdfName = await getGithubData();

        const devData = await require('./developer-data.json');
        // console.log(devData);

        const content = await compile('pdf-template', devData);
        // console.log(content);

        await page.setContent(
            content
        );
        await page.emulateMedia('screen');

        await page.pdf({
            path: `./dev-pdf-generated/${pdfName}.pdf`,
            format: 'A4',
            printBackground: true
        });

        console.log(`Successfully generated ${pdfName}.pdf!`);

        await browser.close();
        process.exit();

    } catch (e) {
        console.log('Your GitHub user name is invalid or previously generated pdf file is open', e);
    }
})();