const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");
const acorn = require("acorn");
const walk = require("acorn-walk");

class FunctionIndexer {

    constructor(root){
        this.root = root;
    }

    async build(){

        const files = await fg(
            [
                "PROJECTS/**/*.js",
                "PROJECTS/**/*.gs"
            ],
            {
                cwd:this.root,
                absolute:false,
                ignore:[
                    "**/node_modules/**",
                    "**/.git/**"
                ]
            }
        );

        const functions = [];

        for(const file of files){

            const full = path.join(this.root,file);

            let source="";

            try{
                source = fs.readFileSync(full,"utf8");
            }catch{
                continue;
            }

            let ast;

            try{

                ast = acorn.parse(source,{
                    ecmaVersion:"latest",
                    sourceType:"script",
                    locations:true
                });

            }catch{
                continue;
            }

            walk.simple(ast,{

                FunctionDeclaration(node){

                    functions.push({
                        name:node.id?.name || "<anonymous>",
                        file:file,
                        line:node.loc.start.line,
                        project:file.split(path.sep)[1]
                    });

                }

            });

        }

        const duplicates =
            Object.values(
                functions.reduce((a,f)=>{
                    a[f.name]??=[];
                    a[f.name].push(f);
                    return a;
                },{})
            ).filter(x=>x.length>1);

        return{
            generated:new Date().toISOString(),
            totalFunctions:functions.length,
            duplicates:duplicates.length,
            functions,
            duplicateFunctions:duplicates
        };

    }

    async writeReport(reportFolder){

        fs.mkdirSync(reportFolder,{recursive:true});

        const report = await this.build();

        fs.writeFileSync(
            path.join(reportFolder,"FunctionIndex.json"),
            JSON.stringify(report.functions,null,2)
        );

        fs.writeFileSync(
            path.join(reportFolder,"DuplicateFunctions.json"),
            JSON.stringify(report.duplicateFunctions,null,2)
        );

        fs.writeFileSync(
            path.join(reportFolder,"FunctionSummary.json"),
            JSON.stringify({
                totalFunctions:report.totalFunctions,
                duplicateGroups:report.duplicates
            },null,2)
        );

        console.log("");
        console.log("Function Index");
        console.log("--------------------------");
        console.log("Functions :",report.totalFunctions);
        console.log("Duplicates:",report.duplicates);
        console.log("[PASS]");

    }

}

module.exports = FunctionIndexer;