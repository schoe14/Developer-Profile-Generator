const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const axios = require('axios');
const util = require('util');
const hbs = require('handlebars');
const path = require('path');

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

const compile = async function(templateName, data){
    const filePath = path.join(process.cwd(), 'templates', `${templateName}.hbs`);
    const html = await readFileAsync (
        filePath,
        "utf8"
    );
    return hbs.compile(html)(data);
};

function promptUser() {
    return inquirer.prompt([
        {
            type: "input",
            name: "userName",
            message: "What is your GitHub user name?"
        },
        {
            type: "input",
            name: "color",
            message: "What is your favorite color?"
        }
    ]);
}

(async function () {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        // -----------------------------------------------------------------------------------
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
        // -------------------------------------------------------------------------------------
        const locationArr = data.location.split(", ");
        const infoObj = {
            profileImg: data.avatar_url, name: data.name,
            location: data.location, locationLink: `https://www.google.com/maps/place/${data.location}`, githubProfile: data.html_url, blog: data.blog, bio: data.bio,
            publicRepos: data.public_repos, followers: data.followers, githubStars: starsCount,
            following: data.following, favoriteColor: answers.color
        };

        await writeFileAsync(
            "developer-data.json",
            JSON.stringify(infoObj, null, 2),
            "utf8"
        );

        const devData = await require('./developer-data.json');
        console.log(devData);

        const content = await compile('pdf-template', devData);
        console.log(content);

        await page.setContent(
            content
        );
        await page.emulateMedia('screen');
        await page.pdf({
            path: `./dev-pdf-generated/${infoObj.name}.pdf`,
            format: 'A4',
            printBackground: true
        });

        console.log('Successfully generated pdf!');

        await browser.close();
        process.exit();

    } catch (e) {
        console.log('error', e);
    }
})();