import groovy.json.JsonOutput

def transition = ~/(?:Project (.+?) - )?Transitioning model element '(.+?)' to state ([a-zA-Z]+)/
def registration = ~/(?:Project (.+?) - )?Registering model element '(.+?)'(?: \(hidden = (true|false)\))?/

def normalize(String path) {
   path=='<root>'?'':path
}

def data = []
System.in.eachLine { line ->
    def match = transition.matcher(line)
    if (match) {
        data << [
		project: match[0][1]?:'',
                path: normalize(match[0][2]),
                type: 'state-changed',
                state: match[0][3]
        ]
    } else {
        match = registration.matcher(line)
        if (match) {
            data << [
		    project: match[0][1]?:'',
                    path: normalize(match[0][2]),
                    type: 'state-changed',
                    state: 'Registered',
                    hidden: match[0][3]=='true'? true : false
            ]
        }
    }
}
println JsonOutput.prettyPrint(JsonOutput.toJson(data))
