import groovy.json.JsonOutput

def transition = ~/Transitioning model element '(.+?)' to state ([a-zA-Z]+)/
def registration = ~/"Registering model element '(.+?)'"/
def data = []
System.in.eachLine { line ->
    def match = transition.matcher(line)
    if (match) {
        data << [
                path: match[0][1],
                type: 'state-changed',
                state: match[0][2]
        ]
    } else {
        match = registration.matcher(line)
        if (match) {
            data << [
                    path: match[0][1],
                    type: 'state-changed',
                    state: 'Registered'
            ]
        }
    }
}
println JsonOutput.prettyPrint(JsonOutput.toJson(data))
